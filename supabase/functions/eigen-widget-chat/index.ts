import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { verifyWidgetSessionToken } from '../_shared/widget-session.ts';
import { resolveEigenxPolicyScope } from '../_shared/eigen-policy-access.ts';
import { POLICY_TAG_EIGENX } from '../_shared/eigen-policy.ts';

interface WidgetChatRequest {
  widget_token: string;
  message: string;
  response_format?: 'structured' | 'freeform';
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
}

function parseRequest(value: unknown): WidgetChatRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  const body = value as Record<string, unknown>;
  if (typeof body.widget_token !== 'string' || body.widget_token.trim().length === 0) {
    throw new Error('widget_token is required');
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new Error('message is required');
  }
  const budget = body.budget_profile && typeof body.budget_profile === 'object'
    ? body.budget_profile as Record<string, unknown>
    : {};
  return {
    widget_token: body.widget_token.trim(),
    message: body.message.trim(),
    response_format: body.response_format === 'freeform' ? 'freeform' : 'structured',
    budget_profile: {
      max_chunks: typeof budget.max_chunks === 'number' ? budget.max_chunks : undefined,
      max_tokens: typeof budget.max_tokens === 'number' ? budget.max_tokens : undefined,
      strata_weights: typeof budget.strata_weights === 'object'
        ? budget.strata_weights as Record<string, number>
        : undefined,
    },
  };
}

function buildContext(chunks: EigenRetrieveChunk[]): string {
  return chunks.map((chunk, i) => `[${i + 1}] ${chunk.content}`).join('\n\n');
}

function buildCitations(chunks: EigenRetrieveChunk[]) {
  return chunks.slice(0, 8).map((chunk) => ({
    chunk_id: chunk.chunk_id,
    source: chunk.provenance?.source_ref ?? chunk.provenance?.source_system ?? 'unknown',
    relevance: Number(chunk.composite_score?.toFixed(4) ?? 0),
  }));
}

function readWidgetMaxTokens(format: 'structured' | 'freeform'): number {
  const raw = Deno.env.get('EIGEN_WIDGET_CHAT_MAX_TOKENS') ?? '';
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 128) return Math.min(parsed, 4000);
  return format === 'freeform' ? 1400 : 1100;
}

function readWidgetTemperature(mode: 'public' | 'eigenx'): number {
  const specific = mode === 'public'
    ? Deno.env.get('EIGEN_WIDGET_PUBLIC_TEMPERATURE')
    : Deno.env.get('EIGEN_WIDGET_EIGENX_TEMPERATURE');
  const fallback = mode === 'public' ? '0.38' : '0.28';
  const raw = (specific && specific.trim()) || Deno.env.get('EIGEN_WIDGET_CHAT_TEMPERATURE') || fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return Number.parseFloat(fallback);
  return Math.min(1.2, Math.max(0, n));
}

function defaultWidgetSystemPrompt(mode: 'public' | 'eigenx', hasContext: boolean): string {
  if (mode === 'public') {
    if (hasContext) {
      return [
        'You are Public Eigen, Ray\'s public-facing assistant.',
        'Retrieved context is public-facing material only; do not infer or disclose internal tools, dashboards, credentials, or non-public operations.',
        'Mention tools, products, or services only when they clearly appear in the retrieved text as public-site content.',
        'Use retrieved context as the source of truth for anything specific to Rays Retreat, R2, products, policies, people, or offerings.',
        'Write in a natural, conversational tone (warm, direct, founder-like).',
        'When context is strong, weave facts in smoothly; when it is thin or off-topic, still reply helpfully,',
        'but clearly separate what comes from the materials versus general guidance, and do not invent numbers, dates, or commitments.',
        'Brief greetings, empathy, and follow-up questions are encouraged.',
      ].join(' ');
    }
    return [
      'You are Public Eigen, Ray\'s public-facing assistant.',
      'No retrieved documents matched this turn yet.',
      'Reply in a warm, conversational way. Do not invent specific facts about Rays Retreat, R2, products, prices, policies, or people.',
      'Do not describe internal tools or non-public systems; only public-site information belongs in answers once context exists.',
      'You may offer general encouragement, clarify what they need, or suggest topics they could ask about once content is available.',
    ].join(' ');
  }
  if (hasContext) {
    return [
      'You are EigenX, the internal assistant.',
      'Prioritize retrieved context for factual claims about the organization and internal materials.',
      'Be conversational and concise; explain uncertainty when context is partial.',
      'Do not fabricate sensitive specifics; ask a clarifying question when needed.',
    ].join(' ');
  }
  return [
    'You are EigenX. No retrieved context was returned for this message.',
    'Respond conversationally without inventing internal or confidential specifics.',
    'Offer to help once they point you at a document, area, or clearer question.',
  ].join(' ');
}

async function synthesize(
  mode: 'public' | 'eigenx',
  message: string,
  chunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const hasContext = chunks.length > 0;

  if (!apiKey) {
    if (!hasContext) {
      return mode === 'public'
        ? 'Hi — I\'m Eigen. I don\'t have matching sourced details for that yet, but I\'m here. What would you like to know about Rays Retreat or R2?'
        : 'I don\'t have retrieved context for that yet. Try rephrasing or point me at a specific topic.';
    }
    return chunks.slice(0, 3).map((c, i) => `${i + 1}. ${c.content.slice(0, 220)}`).join('\n');
  }

  const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const envPrompt = mode === 'public'
    ? Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')
    : Deno.env.get('EIGENX_SYSTEM_PROMPT');
  const systemPrompt = (envPrompt && envPrompt.trim()) || defaultWidgetSystemPrompt(mode, hasContext);

  const userContent = hasContext
    ? `User message: ${message}\n\nRetrieved context (use for specifics; cite mentally by snippet number if helpful):\n${buildContext(chunks)}`
    : `User message: ${message}`;

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: readWidgetTemperature(mode),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: readWidgetMaxTokens(format),
    }),
  });
  if (!completion.ok) throw new Error(`Chat completion failed: ${completion.status}`);
  const payload = await completion.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() || 'No response generated.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = parseRequest(await req.json());
    const claims = await verifyWidgetSessionToken(body.widget_token);

    const origin = (req.headers.get('origin') ?? '').replace(/\/+$/, '').toLowerCase();
    if (!origin || origin !== claims.origin) {
      return errorResponse('Widget origin mismatch', 403);
    }

    const client = getServiceClient();
    let effectivePolicyScope = claims.default_policy_scope;
    if (claims.mode === 'eigenx' && claims.user_id) {
      const scopeResolution = await resolveEigenxPolicyScope(client, {
        userId: claims.user_id,
        requestedPolicyScope: claims.default_policy_scope,
        defaultPolicyScope: [POLICY_TAG_EIGENX],
      });
      if (scopeResolution.grantsConfigured && scopeResolution.effectivePolicyScope.length === 0) {
        return errorResponse('No private policy scope access for this user', 403);
      }
      effectivePolicyScope = scopeResolution.effectivePolicyScope;
    }

    const retrieveResult = await executeEigenRetrieve(client, {
      query: body.message,
      policy_scope: effectivePolicyScope,
      site_id: claims.site_id,
      site_source_systems: claims.site_source_systems,
      budget_profile: body.budget_profile ?? { max_chunks: 10, max_tokens: 3000 },
      rerank: true,
      include_provenance: true,
    });
    if (!retrieveResult.ok) return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);

    const responseText = await synthesize(
      claims.mode,
      body.message,
      retrieveResult.body.chunks,
      body.response_format ?? 'structured',
    );
    const citations = buildCitations(retrieveResult.body.chunks);
    return jsonResponse({
      response: responseText,
      citations,
      confidence: citations.length >= 6 ? 'high' : citations.length >= 3 ? 'medium' : 'low',
      retrieval_run_id: retrieveResult.body.retrieval_run_id,
      site_id: claims.site_id,
      mode: claims.mode,
      effective_policy_scope: effectivePolicyScope,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
