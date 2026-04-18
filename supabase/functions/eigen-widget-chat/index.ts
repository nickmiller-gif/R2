import { corsHeaders, corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { verifyWidgetSessionToken } from '../_shared/widget-session.ts';
import { resolveEffectiveEigenxScope } from '../_shared/eigenx-scope-resolver.ts';
import {
  EIGEN_RETRIEVED_CONTEXT_INTRO,
  withEigenChatProseStyle,
} from '../_shared/eigen-chat-answer-style.ts';
import {
  buildCitations,
  buildCompositeConfidence,
  buildUploadFirstStrataWeights,
  type ConfidenceLabel,
  type LlmProvider,
} from '../_shared/eigen-chat-contract.ts';
import { completeLlmChat, streamLlmChatDeltas } from '../_shared/llm-chat.ts';
import { inferOutsideDomainIntent } from '../../../src/lib/eigen/source-relevance-gating.ts';
import { fetchRayVoiceStyleAddendum } from '../_shared/ray-voice-style.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { buildRetrievalPlan, insertConversationTurn } from '../_shared/conversation-turn.ts';

interface WidgetChatRequest {
  widget_token: string;
  message: string;
  response_format?: 'structured' | 'freeform';
  conversation_intent?: 'retreat_content' | 'event_ops' | 'general';
  llm_provider?: LlmProvider;
  llm_model?: string;
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
  stream?: boolean;
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
    conversation_intent:
      body.conversation_intent === 'retreat_content' || body.conversation_intent === 'event_ops'
        ? (body.conversation_intent as WidgetChatRequest['conversation_intent'])
        : 'general',
    llm_provider:
      body.llm_provider === 'openai' || body.llm_provider === 'anthropic' || body.llm_provider === 'perplexity'
        ? (body.llm_provider as LlmProvider)
        : undefined,
    llm_model: typeof body.llm_model === 'string' ? body.llm_model.trim() : undefined,
    budget_profile: {
      max_chunks: typeof budget.max_chunks === 'number' ? budget.max_chunks : undefined,
      max_tokens: typeof budget.max_tokens === 'number' ? budget.max_tokens : undefined,
      strata_weights: typeof budget.strata_weights === 'object'
        ? budget.strata_weights as Record<string, number>
        : undefined,
    },
    stream: body.stream === true,
  };
}

function buildContext(chunks: EigenRetrieveChunk[]): string {
  return chunks.map((chunk, i) => `[${i + 1}] ${chunk.content}`).join('\n\n');
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
  client: ReturnType<typeof getServiceClient>,
  mode: 'public' | 'eigenx',
  policyScope: string[],
  message: string,
  chunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
  llmProvider: LlmProvider | undefined,
  llmModel: string | undefined,
  confidenceLabel: ConfidenceLabel,
): Promise<{ text: string; critic_used: boolean; critic_provider?: LlmProvider; critic_model?: string }> {
  const hasContext = chunks.length > 0;

  const envPrompt = mode === 'public'
    ? Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')
    : Deno.env.get('EIGENX_SYSTEM_PROMPT');
  const basePrompt = (envPrompt && envPrompt.trim()) || defaultWidgetSystemPrompt(mode, hasContext);
  const voiceStyleAddendum = await fetchRayVoiceStyleAddendum(client, {
    message,
    includePrivate: mode === 'eigenx',
    policyScope,
  });
  const systemPrompt = [
    withEigenChatProseStyle(basePrompt),
    'Primary domain corpus decides answer direction; secondary corpus is additive only.',
    voiceStyleAddendum,
  ]
    .filter(Boolean)
    .join('\n\n');

  const labeled = buildContext(chunks);
  const userContent = hasContext
    ? `User message: ${message}\n\n${EIGEN_RETRIEVED_CONTEXT_INTRO}\n${labeled}`
    : `User message: ${message}`;

  const result = await completeLlmChat({
    provider: llmProvider,
    model: llmModel,
    systemPrompt,
    userContent,
    maxTokens: readWidgetMaxTokens(format),
    temperature: readWidgetTemperature(mode),
    critic: {
      enabled: true,
      confidence_label: confidenceLabel,
      trigger_at: 'medium',
    },
  });
  return {
    text: result.text?.trim() || 'No response generated.',
    critic_used: result.critic_used === true,
    critic_provider: result.critic_provider,
    critic_model: result.critic_model,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  const idemError = requireIdempotencyKey(req);
  if (idemError) return idemError;
  const idempotencyKey = req.headers.get('x-idempotency-key')?.trim() || null;

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
      const scopeResolution = await resolveEffectiveEigenxScope({
        client,
        userId: claims.user_id,
        explicitScope: claims.default_policy_scope,
      });
      if (scopeResolution.emptyAfterGrantIntersection) {
        return errorResponse('No private policy scope access for this user', 403);
      }
      effectivePolicyScope = scopeResolution.effectivePolicyScope;
    }

    const retreatScopedPublic = claims.mode === 'public' && claims.site_id === 'raysretreat';
    const r2AppScopedPublic = claims.mode === 'public' && claims.site_id === 'r2app';
    const outsideDomainIntent = inferOutsideDomainIntent(body.message);

    const retrieveResult = await executeEigenRetrieve(client, {
      query: body.message,
      policy_scope: effectivePolicyScope,
      site_id: claims.site_id,
      site_source_systems: claims.site_source_systems,
      site_boost: retreatScopedPublic ? 0.7 : (r2AppScopedPublic ? 0.6 : undefined),
      global_penalty: retreatScopedPublic ? -0.4 : (r2AppScopedPublic ? -0.35 : undefined),
      site_relevance_min: retreatScopedPublic ? 0.36 : (r2AppScopedPublic ? 0.3 : undefined),
      cross_source_max_ratio: retreatScopedPublic ? 0.2 : (r2AppScopedPublic ? 0.15 : undefined),
      allow_cross_source_when_low_confidence: retreatScopedPublic,
      outside_domain_intent: outsideDomainIntent,
      disallowed_source_systems:
        (retreatScopedPublic && body.conversation_intent === 'retreat_content' && !outsideDomainIntent) ||
        (r2AppScopedPublic && body.conversation_intent === 'event_ops' && !outsideDomainIntent)
          ? ['health-supplement-tr', 'smartplrx']
          : [],
      budget_profile: body.budget_profile
        ? {
            ...body.budget_profile,
            strata_weights: buildUploadFirstStrataWeights(body.budget_profile.strata_weights),
          }
        : { max_chunks: 10, max_tokens: 3000, strata_weights: buildUploadFirstStrataWeights() },
      rerank: true,
      include_provenance: true,
    });
    if (!retrieveResult.ok) return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);

    const citations = buildCitations(retrieveResult.body.chunks);
    const confidence = buildCompositeConfidence(citations);
    const retrievalPlan = buildRetrievalPlan(
      effectivePolicyScope,
      retrieveResult.body.chunks,
      retrieveResult.body.retrieval_run_id,
    );
    const startedAt = Date.now();
    const format = body.response_format ?? 'structured';

    if (body.stream === true || req.headers.get('accept')?.includes('text/event-stream')) {
      const hasContext = retrieveResult.body.chunks.length > 0;
      const envPrompt = claims.mode === 'public'
        ? Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')
        : Deno.env.get('EIGENX_SYSTEM_PROMPT');
      const basePrompt = (envPrompt && envPrompt.trim()) || defaultWidgetSystemPrompt(claims.mode, hasContext);
      const voiceStyleAddendum = await fetchRayVoiceStyleAddendum(client, {
        message: body.message,
        includePrivate: claims.mode === 'eigenx',
        policyScope: effectivePolicyScope,
      });
      const systemPrompt = [
        withEigenChatProseStyle(basePrompt),
        'Primary domain corpus decides answer direction; secondary corpus is additive only.',
        voiceStyleAddendum,
      ]
        .filter(Boolean)
        .join('\n\n');
      const labeled = buildContext(retrieveResult.body.chunks);
      const userContent = hasContext
        ? `User message: ${body.message}\n\n${EIGEN_RETRIEVED_CONTEXT_INTRO}\n${labeled}`
        : `User message: ${body.message}`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const emit = (event: string, data: string) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
          };
          const deltas: string[] = [];
          try {
            const iterator = streamLlmChatDeltas({
              provider: body.llm_provider,
              model: body.llm_model,
              systemPrompt,
              userContent,
              maxTokens: readWidgetMaxTokens(format),
              temperature: readWidgetTemperature(claims.mode),
            });
            while (true) {
              const next = await iterator.next();
              if (next.done) {
                if (next.value?.text && !deltas.length) {
                  deltas.push(next.value.text);
                }
                break;
              }
              const delta = next.value;
              deltas.push(delta);
              emit('delta', JSON.stringify({ delta }));
            }
            const responseText = deltas.join('').trim() || 'No response generated.';
            const turnId = await insertConversationTurn(client, {
              siteId: claims.site_id,
              mode: claims.mode,
              userId: claims.user_id ?? null,
              question: body.message,
              answer: responseText,
              retrievalRunId: retrieveResult.body.retrieval_run_id,
              effectivePolicyScope,
              citations,
              confidence,
              retrievalPlan,
              latencyMs: Date.now() - startedAt,
              idempotencyKey,
            });
            emit('final', JSON.stringify({
              response: responseText,
              citations,
              confidence,
              llm_provider: body.llm_provider ?? 'openai',
              llm_model: body.llm_model ?? null,
              llm_critic_used: false,
              llm_critic_provider: null,
              llm_critic_model: null,
              conversation_turn_id: turnId,
              retrieval_run_id: retrieveResult.body.retrieval_run_id,
              retrieval_plan: retrievalPlan,
              site_id: claims.site_id,
              mode: claims.mode,
              effective_policy_scope: effectivePolicyScope,
            }));
          } catch (error) {
            try {
              const message = error instanceof Error ? error.message : 'Unknown stream error';
              emit('error', JSON.stringify({ message }));
            } catch {
              // Client disconnect can close the stream before error delivery.
            }
          } finally {
            try {
              controller.close();
            } catch {
              // Stream may already be closed/errored.
            }
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const synthesis = await synthesize(
      client,
      claims.mode,
      effectivePolicyScope,
      body.message,
      retrieveResult.body.chunks,
      format,
      body.llm_provider,
      body.llm_model,
      confidence.overall,
    );
    const turnId = await insertConversationTurn(client, {
      siteId: claims.site_id,
      mode: claims.mode,
      userId: claims.user_id ?? null,
      question: body.message,
      answer: synthesis.text,
      retrievalRunId: retrieveResult.body.retrieval_run_id,
      effectivePolicyScope,
      citations,
      confidence,
      retrievalPlan,
      latencyMs: Date.now() - startedAt,
      idempotencyKey,
    });
    return jsonResponse({
      response: synthesis.text,
      citations,
      confidence,
      conversation_turn_id: turnId,
      retrieval_plan: retrievalPlan,
      llm_provider: body.llm_provider ?? 'openai',
      llm_model: body.llm_model ?? null,
      llm_critic_used: synthesis.critic_used,
      llm_critic_provider: synthesis.critic_provider ?? null,
      llm_critic_model: synthesis.critic_model ?? null,
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
