import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { completeLlmChat } from '../_shared/llm-chat.ts';
import { buildSourceSignalKey, timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { parseKbDriverId, type KbDriverId } from '../_shared/autonomous-scout-drivers.ts';

type ScoutArticle = {
  title: string;
  url?: string;
  source?: string;
  published_at?: string;
  snippet?: string;
};

type ScoutRequest = {
  topic: string;
  context?: string;
  articles?: ScoutArticle[];
  target_kb_driver?: KbDriverId;
};

type UpgradeCandidate = {
  headline: string;
  why_now: string;
  proposed_bot_action: string;
  confidence: number;
  impacted_stream: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeArticle(value: unknown): ScoutArticle | null {
  if (!isObject(value)) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title) return null;
  return {
    title,
    url: typeof value.url === 'string' ? value.url.trim() : undefined,
    source: typeof value.source === 'string' ? value.source.trim() : undefined,
    published_at: typeof value.published_at === 'string' ? value.published_at.trim() : undefined,
    snippet: typeof value.snippet === 'string' ? value.snippet.trim() : undefined,
  };
}

function parseRequest(value: unknown): ScoutRequest {
  if (!isObject(value)) throw new Error('Request body must be a JSON object');
  const topic = typeof value.topic === 'string' ? value.topic.trim() : '';
  if (!topic) throw new Error('topic is required');

  const context = typeof value.context === 'string' ? value.context.trim() : undefined;
  const target_kb_driver = parseKbDriverId(value.target_kb_driver) ?? undefined;
  const incomingArticles = Array.isArray(value.articles) ? value.articles : [];
  const articles = incomingArticles
    .map(normalizeArticle)
    .filter((entry): entry is ScoutArticle => !!entry);

  if (!context && articles.length === 0) {
    throw new Error('Provide context and/or at least one valid article');
  }

  return { topic, context, articles, target_kb_driver };
}

function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function normalizeUpgrade(value: unknown): UpgradeCandidate | null {
  if (!isObject(value)) return null;
  const headline = typeof value.headline === 'string' ? value.headline.trim() : '';
  const why_now = typeof value.why_now === 'string' ? value.why_now.trim() : '';
  const proposed_bot_action =
    typeof value.proposed_bot_action === 'string' ? value.proposed_bot_action.trim() : '';
  const impacted_stream =
    typeof value.impacted_stream === 'string' ? value.impacted_stream.trim() : 'Stream A';
  const parsedConfidence = Number(value.confidence);
  const confidence = Number.isFinite(parsedConfidence)
    ? Math.max(0, Math.min(1, parsedConfidence))
    : 0.65;

  if (!headline || !why_now || !proposed_bot_action) return null;
  return { headline, why_now, proposed_bot_action, confidence, impacted_stream };
}

function parseUpgrades(text: string): UpgradeCandidate[] {
  const candidate = extractJsonCandidate(text);
  const parsed = JSON.parse(candidate) as unknown;
  const arrayPayload = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.upgrades)
      ? parsed.upgrades
      : [];

  const upgrades = arrayPayload
    .map(normalizeUpgrade)
    .filter((item): item is UpgradeCandidate => !!item)
    .slice(0, 8);

  if (upgrades.length === 0) {
    throw new Error('Model returned no valid upgrade candidates');
  }
  return upgrades;
}

function toArticlePrompt(articles: ScoutArticle[]): string {
  if (articles.length === 0) return 'No article list provided.';
  return articles
    .map((article, index) => {
      const lines = [
        `${index + 1}. ${article.title}`,
        article.source ? `   source: ${article.source}` : null,
        article.url ? `   url: ${article.url}` : null,
        article.published_at ? `   published_at: ${article.published_at}` : null,
        article.snippet ? `   snippet: ${article.snippet}` : null,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n');
}

function summarizeUpgrades(upgrades: UpgradeCandidate[]): string {
  return upgrades
    .slice(0, 3)
    .map((item) => `${item.headline} (${Math.round(item.confidence * 100)}%)`)
    .join('; ');
}

function hasInternalServiceToken(req: Request): boolean {
  const configured = Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ?? '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  if (!supplied) return false;
  return timingSafeEqual(supplied, configured);
}

async function emitSignalEnvelope(
  request: ScoutRequest,
  upgrades: UpgradeCandidate[],
  idempotencyKey: string,
): Promise<{ signal_id: string | null; status: number }> {
  const sourceSystem = 'autonomous_bot_os';
  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'futuristic_upgrade_scouted',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: new Date().toISOString(),
    summary: `Autonomous upgrade scout: ${request.topic} -> ${summarizeUpgrades(upgrades)}`,
    raw_payload: {
      topic: request.topic,
      context: request.context ?? null,
      target_kb_driver: request.target_kb_driver ?? null,
      articles: request.articles ?? [],
      upgrades,
      generator: 'autonomous-upgrade-scout',
    },
    confidence: Number(
      (upgrades.reduce((sum, entry) => sum + entry.confidence, 0) / upgrades.length).toFixed(3),
    ),
    privacy_level: 'operator',
    provenance: {
      tool: 'autonomous-upgrade-scout',
      generated_at: new Date().toISOString(),
    },
    routing_targets: ['operator_workbench'],
  };

  const sourceSignalKey = buildSourceSignalKey(sourceSystem, `upgrade_scout:${idempotencyKey}`);
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;

  const insertResult = await client
    .from('platform_feed_items')
    .insert({
      contract_version: envelope.contract_version,
      source_system: envelope.source_system,
      source_repo: envelope.source_repo,
      source_event_type: envelope.source_event_type,
      source_signal_key: sourceSignalKey,
      actor_meg_entity_id: envelope.actor_meg_entity_id,
      related_entity_ids: envelope.related_entity_ids,
      event_time: envelope.event_time,
      summary: envelope.summary,
      payload: envelope.raw_payload,
      confidence: envelope.confidence,
      privacy_level: envelope.privacy_level,
      provenance: envelope.provenance,
      routing_targets: envelope.routing_targets,
    })
    .select('id')
    .single();

  let signalId: string | null = null;
  if (!insertResult.error && insertResult.data?.id) {
    signalId = insertResult.data.id as string;
  } else if (insertResult.error && (insertResult.error as { code?: string }).code === '23505') {
    const existing = await client
      .from('platform_feed_items')
      .select('id')
      .eq('source_signal_key', sourceSignalKey)
      .maybeSingle();
    if (existing.error || !existing.data?.id) {
      throw new Error(existing.error?.message ?? 'Failed to resolve idempotent replay');
    }
    signalId = existing.data.id as string;
  } else {
    throw new Error(insertResult.error?.message ?? 'Failed to insert scout signal');
  }

  const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
  if (enqueue.error) throw new Error(enqueue.error.message);

  return { signal_id: signalId, status: 202 };
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-upgrade-scout');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const trustedInternalCall = hasInternalServiceToken(req);
    if (!trustedInternalCall) {
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const isServiceRole = auth.claims.role === 'service_role';
      if (!isServiceRole) {
        const roleCheck = await requireRole(auth.claims.userId, 'member');
        if (!roleCheck.ok) return roleCheck.response;
      }
    }

    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
    if (!idempotencyKey) return errorResponse('Missing x-idempotency-key', 400);

    let parsedRequest: ScoutRequest;
    try {
      parsedRequest = parseRequest(await req.json());
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Invalid request body', 400);
    }

    const driverLine = parsedRequest.target_kb_driver
      ? `Target KB driver: ${parsedRequest.target_kb_driver}`
      : 'Target KB driver: portfolio-wide';

    const prompt = [
      `Topic: ${parsedRequest.topic}`,
      driverLine,
      parsedRequest.context ? `Context:\n${parsedRequest.context}` : 'Context: none provided.',
      `Articles:\n${toArticlePrompt(parsedRequest.articles ?? [])}`,
      '',
      'Return strictly JSON with this shape:',
      '{ "upgrades": [{ "headline": string, "why_now": string, "proposed_bot_action": string, "confidence": number (0-1), "impacted_stream": string }] }',
      'Generate 3 to 6 concrete upgrades. Focus on deployable bot improvements and production-safe automation.',
      'Set impacted_stream to Stream A (CentralR2), Stream D (R2Works), Truth Market (R2Chart), or Stream E (R2-IP) when applicable.',
    ].join('\n');

    let upgrades: UpgradeCandidate[];
    try {
      const completion = await completeLlmChat({
        provider: 'openai',
        systemPrompt:
          'You are an autonomous operations strategist. Produce concise, high-signal upgrades grounded only in provided context.',
        userContent: prompt,
        maxTokens: 900,
        temperature: 0.2,
      });
      upgrades = parseUpgrades(completion.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upgrade generation failed';
      log.error('upgrade_scout_generation_failed', { message, topic: parsedRequest.topic });
      return errorResponse(message, 500);
    }

    try {
      const emitted = await emitSignalEnvelope(parsedRequest, upgrades, idempotencyKey);
      log.info('upgrade_scout_emitted', {
        topic: parsedRequest.topic,
        upgrades: upgrades.length,
        signal_id: emitted.signal_id,
        ingest_status: emitted.status,
      });
      return jsonResponse(
        {
          topic: parsedRequest.topic,
          upgrades,
          signal_id: emitted.signal_id,
          emitted_status: emitted.status,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signal emission failed';
      log.error('upgrade_scout_emit_failed', { message, topic: parsedRequest.topic });
      return errorResponse(message, 500);
    }
  }),
);
