import { corsHeaders, corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { POLICY_TAG_EIGEN_PUBLIC } from '../_shared/eigen-policy.ts';
import { enforceEigenPublicRateLimit } from '../_shared/public-rate-limit.ts';
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
import { inferOutsideDomainIntent } from '../_shared/source-relevance-gating.ts';
import { fetchRayVoiceStyleAddendum } from '../_shared/ray-voice-style.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

interface PublicChatRequest {
  message: string;
  response_format?: 'structured' | 'freeform';
  llm_provider?: LlmProvider;
  llm_model?: string;
  conversation_intent?: 'retreat_content' | 'event_ops' | 'general';
  site_id?: string;
  site_source_systems?: string[];
  site_boost?: number;
  global_penalty?: number;
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
  stream?: boolean;
}

function buildEvidenceNotice(confidence: ReturnType<typeof buildCompositeConfidence>): string | null {
  if (confidence.overall === 'high') return null;
  if (confidence.overall === 'medium') {
    return 'Some parts are weakly supported; use citations for confirmation.';
  }
  return 'Limited public evidence was retrieved for this answer.';
}

function readMaxMessageChars(): number {
  const raw = Deno.env.get('EIGEN_PUBLIC_MAX_MESSAGE_CHARS') ?? '12000';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 500) return 12000;
  return Math.min(n, 100000);
}

function readMaxCompletionTokens(): number {
  const raw = Deno.env.get('EIGEN_PUBLIC_MAX_TOKENS') ?? '900';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 64) return 900;
  return Math.min(n, 4000);
}

function parseRequest(value: unknown): PublicChatRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  assertNoClientPolicyScopeOverride(value);
  const body = value as Record<string, unknown>;
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new Error('message is required');
  }
  const maxChars = readMaxMessageChars();
  if (body.message.length > maxChars) {
    throw new Error(`message exceeds maximum length (${maxChars} characters)`);
  }

  let budget_profile: PublicChatRequest['budget_profile'];
  if (body.budget_profile && typeof body.budget_profile === 'object') {
    const bp = body.budget_profile as Record<string, unknown>;
    budget_profile = {
      max_chunks: typeof bp.max_chunks === 'number' ? bp.max_chunks : undefined,
      max_tokens: typeof bp.max_tokens === 'number' ? bp.max_tokens : undefined,
      strata_weights:
        typeof bp.strata_weights === 'object' && bp.strata_weights !== null
          ? (bp.strata_weights as Record<string, number>)
          : undefined,
    };
  }

  return {
    message: body.message.trim(),
    response_format: body.response_format === 'freeform' ? 'freeform' : 'structured',
    llm_provider:
      body.llm_provider === 'openai' ||
      body.llm_provider === 'anthropic' ||
      body.llm_provider === 'perplexity'
        ? (body.llm_provider as LlmProvider)
        : undefined,
    llm_model: typeof body.llm_model === 'string' ? body.llm_model.trim() : undefined,
    conversation_intent:
      body.conversation_intent === 'retreat_content' || body.conversation_intent === 'event_ops'
        ? (body.conversation_intent as PublicChatRequest['conversation_intent'])
        : 'general',
    site_id: typeof body.site_id === 'string' ? body.site_id.trim() : undefined,
    site_source_systems: Array.isArray(body.site_source_systems)
      ? body.site_source_systems.map((item) => String(item))
      : [],
    site_boost: typeof body.site_boost === 'number' ? body.site_boost : undefined,
    global_penalty: typeof body.global_penalty === 'number' ? body.global_penalty : undefined,
    budget_profile,
    stream: body.stream === true,
  };
}

function buildContextBlock(chunks: EigenRetrieveChunk[]): string {
  return chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join('\n\n');
}

function buildUserMessageWithContext(message: string, chunks: EigenRetrieveChunk[]): string {
  return `Question: ${message}\n\n${EIGEN_RETRIEVED_CONTEXT_INTRO}\n${buildContextBlock(chunks)}`;
}

function readPublicChatTemperature(): number {
  const raw = Deno.env.get('EIGEN_PUBLIC_CHAT_TEMPERATURE') ?? '0.38';
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 0.38;
  return Math.min(1.2, Math.max(0, n));
}

function defaultPublicPrompt(format: 'structured' | 'freeform', hasContext: boolean): string {
  const withContextBoundary =
    'Retrieved context is public-facing website or approved public material only. ' +
    'Do not disclose internal tools, dashboards, credentials, unreleased products, or non-public operations. ' +
    'Mention tools, products, or services only when they clearly appear in the retrieved text as public-site content.';
  const noContextBoundary =
    'You answer as a public assistant only: never disclose internal tools, dashboards, credentials, or non-public operations. ' +
    'When you later have retrieved public-site text, tools and products may be discussed only as they appear there.';
  if (hasContext) {
    if (format === 'freeform') {
      return [
        'You are Public Eigen, the public-facing assistant for Ray.',
        withContextBoundary,
        'Use retrieved context as the authority for anything specific to Rays Retreat, R2, offerings, policies, or people.',
        'Be conversational and warm; blend facts from context naturally.',
        'If context is thin or only partly relevant, say so briefly and still be helpful without inventing specifics.',
      ].join(' ');
    }
    return [
      'You are Public Eigen, the public-facing assistant for Ray.',
      withContextBoundary,
      'Ground answers in retrieved context for factual claims; keep a practical, founder-like voice.',
      'When context is partial, acknowledge limits clearly and offer useful next steps without guessing numbers or commitments.',
    ].join(' ');
  }
  return [
    'You are Public Eigen, the public-facing assistant for Ray.',
    noContextBoundary,
    'No retrieved public context matched this question.',
    'Reply conversationally. Do not invent facts about Rays Retreat, R2, products, or policies.',
    'Invite them to rephrase or ask what they are trying to accomplish.',
  ].join(' ');
}

async function synthesizePublicResponse(
  client: ReturnType<typeof getServiceClient>,
  message: string,
  retrievedChunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
  llmProvider: LlmProvider | undefined,
  llmModel: string | undefined,
  confidenceLabel: ConfidenceLabel,
): Promise<{
  text: string;
  critic_used: boolean;
  critic_provider?: LlmProvider;
  critic_model?: string;
}> {
  const hasContext = retrievedChunks.length > 0;

  const envPrompt = Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')?.trim();
  const voiceStyleAddendum = await fetchRayVoiceStyleAddendum(client, {
    message,
    includePrivate: false,
    policyScope: [POLICY_TAG_EIGEN_PUBLIC],
  });
  const basePrompt = withEigenChatProseStyle(
    envPrompt && envPrompt.length > 0 ? envPrompt : defaultPublicPrompt(format, hasContext),
  );
  const systemPrompt = [
    basePrompt,
    'Primary domain corpus decides answer direction; secondary corpus is additive only.',
    voiceStyleAddendum,
  ]
    .filter(Boolean)
    .join('\n\n');
  const userContent = hasContext
    ? buildUserMessageWithContext(message, retrievedChunks)
    : `Question: ${message}`;

  const result = await completeLlmChat({
    provider: llmProvider,
    model: llmModel,
    systemPrompt,
    userContent,
    temperature: readPublicChatTemperature(),
    maxTokens: readMaxCompletionTokens(),
    critic: {
      enabled: true,
      confidence_label: confidenceLabel,
      trigger_at: 'medium',
    },
  });
  const answer = result.text?.trim();
  if (!answer) throw new Error('Chat completion returned empty content');
  return {
    text: answer,
    critic_used: result.critic_used === true,
    critic_provider: result.critic_provider,
    critic_model: result.critic_model,
  };
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    try {
      const client = getServiceClient();
      const rate = await enforceEigenPublicRateLimit(client, req);
      if (!rate.ok) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retry_after_sec: rate.retryAfterSec }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': String(rate.retryAfterSec),
            },
          },
        );
      }

      const body = parseRequest(await req.json());
      const retreatScoped = body.site_id === 'raysretreat';
      const r2AppScoped = body.site_id === 'r2app';
      const outsideDomainIntent = inferOutsideDomainIntent(body.message);
      const retrieveResult = await executeEigenRetrieve(client, {
        query: body.message,
        entity_scope: [],
        policy_scope: [POLICY_TAG_EIGEN_PUBLIC],
        site_id: body.site_id,
        site_source_systems: body.site_source_systems ?? [],
        site_boost: body.site_boost ?? (retreatScoped ? 0.7 : r2AppScoped ? 0.6 : undefined),
        global_penalty:
          body.global_penalty ?? (retreatScoped ? -0.4 : r2AppScoped ? -0.35 : undefined),
        site_relevance_min: retreatScoped ? 0.36 : r2AppScoped ? 0.3 : undefined,
        cross_source_max_ratio: retreatScoped ? 0.2 : r2AppScoped ? 0.15 : undefined,
        allow_cross_source_when_low_confidence: retreatScoped,
        outside_domain_intent: outsideDomainIntent,
        disallowed_source_systems:
          (retreatScoped &&
            body.conversation_intent === 'retreat_content' &&
            !outsideDomainIntent) ||
          (r2AppScoped && body.conversation_intent === 'event_ops' && !outsideDomainIntent)
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

      if (!retrieveResult.ok) {
        return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);
      }

      const citations = buildCitations(retrieveResult.body.chunks);
      const confidence = buildCompositeConfidence(citations);
      const synthesis = await synthesizePublicResponse(
        client,
        body.message,
        retrieveResult.body.chunks,
        body.response_format ?? 'structured',
        body.llm_provider,
        body.llm_model,
        confidence.overall,
      );

      return jsonResponse({
        response: synthesis.text,
        citations,
        confidence,
        llm_provider: body.llm_provider ?? 'openai',
        llm_model: body.llm_model ?? null,
        llm_critic_used: synthesis.critic_used,
        llm_critic_provider: synthesis.critic_provider ?? null,
        llm_critic_model: synthesis.critic_model ?? null,
        retrieval_run_id: retrieveResult.body.retrieval_run_id,
        policy_scope_enforced: [POLICY_TAG_EIGEN_PUBLIC],
        rate_limit: {
          limit_per_minute: rate.limit,
          remaining: rate.remaining,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
