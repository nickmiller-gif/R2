import { completeLlmChat } from './llm-chat.ts';
import { buildSourceSignalKey } from './signal-utils.ts';
import { getServiceClient } from './supabase.ts';
import type { KbDriverId } from './autonomous-scout-drivers.ts';

export const MESH_SIGNAL_SOURCES = [
  'centralr2',
  'operator_workbench',
  'r2_works',
  'r2chart',
  'ip_pulse_point',
  'autonomous_bot_os',
] as const;

export type RevolutionaryPattern = {
  title: string;
  domains: string[];
  narrative: string;
  recommended_bot_mesh_action: string;
  confidence: number;
};

export type RecentKbSignal = {
  source_system: string;
  source_event_type: string;
  summary: string;
  event_time: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractJsonCandidate(text: string): string {
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

function normalizePattern(value: unknown): RevolutionaryPattern | null {
  if (!isObject(value)) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const narrative = typeof value.narrative === 'string' ? value.narrative.trim() : '';
  const recommended_bot_mesh_action =
    typeof value.recommended_bot_mesh_action === 'string'
      ? value.recommended_bot_mesh_action.trim()
      : '';
  const domainsRaw = Array.isArray(value.domains) ? value.domains : [];
  const domains = domainsRaw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 6);
  const parsedConfidence = Number(value.confidence);
  const confidence = Number.isFinite(parsedConfidence)
    ? Math.max(0, Math.min(1, parsedConfidence))
    : 0.6;

  if (!title || !narrative || !recommended_bot_mesh_action || domains.length < 2) {
    return null;
  }
  return { title, domains, narrative, recommended_bot_mesh_action, confidence };
}

export function parseRevolutionaryPatterns(text: string): RevolutionaryPattern[] {
  const candidate = extractJsonCandidate(text);
  const parsed = JSON.parse(candidate) as unknown;
  const arrayPayload = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.patterns)
      ? parsed.patterns
      : [];

  const patterns = arrayPayload
    .map(normalizePattern)
    .filter((item): item is RevolutionaryPattern => !!item)
    .slice(0, 6);

  if (patterns.length < 2) {
    throw new Error('Model returned fewer than 2 cross-domain patterns');
  }
  return patterns;
}

export async function fetchRecentKbSignals(
  lookbackHours = 72,
  limit = 48,
): Promise<RecentKbSignal[]> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from('platform_feed_items')
    .select('source_system, source_event_type, summary, event_time')
    .in('source_system', [...MESH_SIGNAL_SOURCES])
    .gte('ingested_at', since)
    .order('ingested_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as RecentKbSignal[];
}

function toSignalDigest(signals: RecentKbSignal[]): string {
  if (signals.length === 0) {
    return 'No recent KB-four signals in the lookback window.';
  }
  return signals
    .map((row, index) => {
      return [
        `${index + 1}. [${row.source_system}/${row.source_event_type}] ${row.summary}`,
        `   event_time: ${row.event_time}`,
      ].join('\n');
    })
    .join('\n');
}

export async function synthesizeRevolutionaryPatterns(input: {
  driverResults: Array<Record<string, unknown>>;
  recentSignals: RecentKbSignal[];
}): Promise<RevolutionaryPattern[]> {
  const prompt = [
    'You are the R2 revolutionary bot mesh strategist.',
    'Synthesize cross-domain patterns that appear across KB-four drivers (CentralR2, R2Works, R2Chart, R2-IP) and autonomous upgrade scouts.',
    'Only use evidence from the driver run summary and recent signal digest below.',
    '',
    `Driver run summary:\n${JSON.stringify(input.driverResults, null, 2)}`,
    '',
    `Recent signal digest:\n${toSignalDigest(input.recentSignals)}`,
    '',
    'Return strictly JSON:',
    '{ "patterns": [{ "title": string, "domains": string[] (2-4 source_system tokens), "narrative": string, "recommended_bot_mesh_action": string, "confidence": number (0-1) }] }',
    'Generate 2 to 5 patterns. Each pattern must span at least two domains.',
    'Bot actions must be production-safe and operator-reviewable (propose class, no auto-exec).',
  ].join('\n');

  const completion = await completeLlmChat({
    provider: 'openai',
    systemPrompt:
      'Produce concise cross-vertical operator intelligence grounded only in supplied signals.',
    userContent: prompt,
    maxTokens: 1100,
    temperature: 0.2,
  });

  return parseRevolutionaryPatterns(completion.text);
}

export async function emitRevolutionaryMeshSignal(input: {
  idempotencyKey: string;
  patterns: RevolutionaryPattern[];
  driverResults: Array<Record<string, unknown>>;
  recentSignalCount: number;
  triggeredBy: 'operator' | 'service';
}): Promise<{ signal_id: string | null; status: number }> {
  const sourceSystem = 'autonomous_bot_os';
  const avgConfidence =
    input.patterns.reduce((sum, entry) => sum + entry.confidence, 0) / input.patterns.length;
  const summaryTitles = input.patterns
    .slice(0, 3)
    .map((p) => p.title)
    .join('; ');

  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'revolutionary_mesh_cycle_completed',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: new Date().toISOString(),
    summary: `Revolutionary bot mesh: ${summaryTitles}`,
    raw_payload: {
      patterns: input.patterns,
      driver_results: input.driverResults,
      recent_signal_count: input.recentSignalCount,
      triggered_by: input.triggeredBy,
      generator: 'autonomous-revolutionary-mesh',
    },
    confidence: Number(avgConfidence.toFixed(3)),
    privacy_level: 'operator',
    provenance: {
      tool: 'autonomous-revolutionary-mesh',
      generated_at: new Date().toISOString(),
    },
    routing_targets: ['operator_workbench'],
  };

  const sourceSignalKey = buildSourceSignalKey(
    sourceSystem,
    `revolutionary_mesh:${input.idempotencyKey}`,
  );
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
    throw new Error(insertResult.error?.message ?? 'Failed to insert mesh signal');
  }

  const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
  if (enqueue.error) throw new Error(enqueue.error.message);

  return { signal_id: signalId, status: 202 };
}

export async function triggerRssCronForMesh(
  drivers: KbDriverId[],
  hourBucket: string,
): Promise<{
  results: Record<string, unknown>[];
  errors: Array<{ driver: string; error: string }>;
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const cronToken = Deno.env.get('AUTONOMOUS_NEWS_CRON_TOKEN')?.trim();
  const scoutToken = Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim();
  if (!supabaseUrl || !scoutToken) {
    throw new Error('SUPABASE_URL and AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN must be configured');
  }

  const results: Record<string, unknown>[] = [];
  const errors: Array<{ driver: string; error: string }> = [];

  for (const driverId of drivers) {
    const url = new URL(`${supabaseUrl}/functions/v1/autonomous-news-rss-cron`);
    url.searchParams.set('driver', driverId);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-idempotency-key': `revolutionary-mesh:${driverId}:${hourBucket}`,
    };
    const bearer = cronToken || scoutToken;
    headers.authorization = `Bearer ${bearer}`;

    try {
      const response = await fetch(url.toString(), { method: 'POST', headers });
      const body = await response.json().catch(() => ({ error: 'non-json response' }));
      if (!response.ok) {
        throw new Error(
          `rss-cron ${driverId} failed (${response.status}): ${JSON.stringify(body)}`,
        );
      }
      const driverResult = Array.isArray((body as { results?: unknown[] }).results)
        ? ((body as { results: Record<string, unknown>[] }).results[0] ?? {
            driver: driverId,
            status: 'unknown',
          })
        : { driver: driverId, status: 'triggered', body };
      results.push(driverResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ driver: driverId, error: message });
    }
  }

  return { results, errors };
}

export async function isAutonomousMeshPaused(): Promise<{
  paused: boolean;
  reason: string | null;
}> {
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const { data, error } = await client
    .from('autonomous_runtime_state')
    .select('paused,pause_reason')
    .eq('singleton', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    paused: data?.paused ?? false,
    reason: typeof data?.pause_reason === 'string' ? data.pause_reason : null,
  };
}
