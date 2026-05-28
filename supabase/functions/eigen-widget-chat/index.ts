import {
  reflectedCorsHeaders,
  reflectedCorsResponse,
  reflectedErrorResponse,
  reflectedJsonResponse,
} from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { verifyWidgetSessionToken } from '../_shared/widget-session.ts';
import { resolveEffectiveEigenxScope } from '../_shared/eigenx-scope-resolver.ts';
import { assertNoClientPolicyScopeOverride } from '../_shared/policy-scope-guard.ts';
import {
  EIGEN_RETRIEVED_CONTEXT_INTRO,
  defaultEigenxSystemPrompt,
  withEigenChatProseStyle,
} from '../_shared/eigen-chat-answer-style.ts';
import {
  eigenRetrievalQualityAppend,
  formatRetrievalContextForLlm,
} from '../../../src/lib/eigen/chat-retrieval-context.ts';
import {
  buildCitations,
  buildCompositeConfidence,
  buildUploadFirstStrataWeights,
  type ConfidenceLabel,
  type LlmProvider,
} from '../_shared/eigen-chat-contract.ts';
import { completeLlmChat } from '../_shared/llm-chat.ts';
import { inferOutsideDomainIntent } from '../_shared/source-relevance-gating.ts';
import { fetchRayVoiceStyleAddendum } from '../_shared/ray-voice-style.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import {
  buildEigenKosCapabilityDenialBody,
  enforceEigenKosCapabilityBundle,
} from '../_shared/eigen-kos-enforcement.ts';
import { EIGEN_KOS_CAPABILITY } from '../../../src/lib/eigen/eigen-kos-capabilities.ts';
import {
  buildUserMessageWithEntityAndRetrievalContext,
  EIGEN_ENTITY_CONTEXT_INTRO,
  formatEntityContextForLlm,
  type ChatEntityForPrompt,
} from '../../../src/lib/eigen/chat-entity-context.ts';
import {
  fetchMegEntityContextForChat,
  resolveChatEntityScope,
} from '../_shared/chat-entity-context.ts';
import type { EntityScopeMode } from '../../../src/lib/eigen/chat-entity-resolver.ts';
import { requireRole } from '../_shared/rbac.ts';

interface WidgetChatRequest {
  widget_token: string;
  message: string;
  entity_scope?: string[];
  entity_label?: string;
  entity_scope_mode?: EntityScopeMode;
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
  assertNoClientPolicyScopeOverride(value);
  const body = value as Record<string, unknown>;
  if (typeof body.widget_token !== 'string' || body.widget_token.trim().length === 0) {
    throw new Error('widget_token is required');
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new Error('message is required');
  }
  const budget =
    body.budget_profile && typeof body.budget_profile === 'object'
      ? (body.budget_profile as Record<string, unknown>)
      : {};
  return {
    widget_token: body.widget_token.trim(),
    message: body.message.trim(),
    entity_scope: Array.isArray(body.entity_scope)
      ? body.entity_scope.map((item) => String(item))
      : [],
    entity_label: typeof body.entity_label === 'string' ? body.entity_label.trim() : undefined,
    entity_scope_mode:
      body.entity_scope_mode === 'boost' || body.entity_scope_mode === 'filter'
        ? body.entity_scope_mode
        : undefined,
    response_format: body.response_format === 'freeform' ? 'freeform' : 'structured',
    conversation_intent:
      body.conversation_intent === 'retreat_content' || body.conversation_intent === 'event_ops'
        ? (body.conversation_intent as WidgetChatRequest['conversation_intent'])
        : 'general',
    llm_provider:
      body.llm_provider === 'openai' ||
      body.llm_provider === 'anthropic' ||
      body.llm_provider === 'perplexity'
        ? (body.llm_provider as LlmProvider)
        : undefined,
    llm_model: typeof body.llm_model === 'string' ? body.llm_model.trim() : undefined,
    budget_profile: {
      max_chunks: typeof budget.max_chunks === 'number' ? budget.max_chunks : undefined,
      max_tokens: typeof budget.max_tokens === 'number' ? budget.max_tokens : undefined,
      strata_weights:
        typeof budget.strata_weights === 'object'
          ? (budget.strata_weights as Record<string, number>)
          : undefined,
    },
    stream: body.stream === true,
  };
}

function readWidgetMaxTokens(format: 'structured' | 'freeform'): number {
  const raw = Deno.env.get('EIGEN_WIDGET_CHAT_MAX_TOKENS') ?? '';
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 128) return Math.min(parsed, 4000);
  return format === 'freeform' ? 1400 : 1100;
}

function readWidgetTemperature(mode: 'public' | 'eigenx'): number {
  const specific =
    mode === 'public'
      ? Deno.env.get('EIGEN_WIDGET_PUBLIC_TEMPERATURE')
      : Deno.env.get('EIGEN_WIDGET_EIGENX_TEMPERATURE');
  const fallback = mode === 'public' ? '0.38' : '0.32';
  const raw =
    (specific && specific.trim()) || Deno.env.get('EIGEN_WIDGET_CHAT_TEMPERATURE') || fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return Number.parseFloat(fallback);
  return Math.min(1.2, Math.max(0, n));
}

function defaultWidgetSystemPrompt(mode: 'public' | 'eigenx', hasContext: boolean): string {
  if (mode === 'public') {
    if (hasContext) {
      return [
        "You are Public Eigen, Ray's public-facing assistant.",
        'Retrieved context is public-facing material only; do not infer or disclose internal tools, dashboards, credentials, or non-public operations.',
        'Mention tools, products, or services only when they clearly appear in the retrieved text as public-site content.',
        'Use retrieved context as the source of truth for anything specific to Rays Retreat, R2, products, policies, people, clients, properties, or offerings.',
        'Write in a natural, conversational tone (warm, direct, founder-like).',
        'When context is strong, weave facts in smoothly; when it is thin or off-topic, still reply helpfully,',
        'but clearly separate what comes from the materials versus general guidance, and do not invent numbers, dates, or commitments.',
        'Brief greetings, empathy, and follow-up questions are encouraged.',
      ].join(' ');
    }
    return [
      "You are Public Eigen, Ray's public-facing assistant.",
      'No retrieved documents matched this turn yet.',
      'Reply in a warm, conversational way. Do not invent specific facts about Rays Retreat, R2, products, prices, policies, people, clients, or properties.',
      'Do not describe internal tools or non-public systems; only public-site information belongs in answers once context exists.',
      'You may offer general encouragement, clarify what they need, or suggest topics they could ask about once content is available.',
    ].join(' ');
  }
  return defaultEigenxSystemPrompt(hasContext);
}

async function synthesize(
  client: ReturnType<typeof getServiceClient>,
  mode: 'public' | 'eigenx',
  policyScope: string[],
  message: string,
  chunks: EigenRetrieveChunk[],
  entityContext: ChatEntityForPrompt[],
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
  const hasContext = chunks.length > 0 || entityContext.length > 0;

  const envPrompt =
    mode === 'public'
      ? Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')
      : Deno.env.get('EIGENX_SYSTEM_PROMPT');
  const basePrompt = (envPrompt && envPrompt.trim()) || defaultWidgetSystemPrompt(mode, hasContext);
  const voiceStyleAddendum = await fetchRayVoiceStyleAddendum(client, {
    message,
    includePrivate: mode === 'eigenx',
    policyScope,
  });
  const retrievalAppend = eigenRetrievalQualityAppend(chunks, confidenceLabel);
  const systemPrompt = [
    withEigenChatProseStyle(basePrompt),
    'Primary domain corpus decides answer direction; secondary corpus is additive only.',
    voiceStyleAddendum,
    retrievalAppend,
  ]
    .filter(Boolean)
    .join('\n\n');

  const userContent = hasContext
    ? buildUserMessageWithEntityAndRetrievalContext({
        message: `User message: ${message}`,
        entityIntro: EIGEN_ENTITY_CONTEXT_INTRO,
        entityBlock: formatEntityContextForLlm(entityContext),
        retrievalIntro: EIGEN_RETRIEVED_CONTEXT_INTRO,
        retrievalBlock: formatRetrievalContextForLlm(chunks),
      })
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

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const rawOrigin = req.headers.get('origin');
    if (req.method === 'OPTIONS') return reflectedCorsResponse(rawOrigin);
    if (req.method !== 'POST') return reflectedErrorResponse(rawOrigin, 'Method not allowed', 405);

    try {
      const body = parseRequest(await req.json());
      const claims = await verifyWidgetSessionToken(body.widget_token);

      const origin = (rawOrigin ?? '').replace(/\/+$/, '').toLowerCase();
      if (!origin || origin !== claims.origin) {
        return reflectedErrorResponse(rawOrigin, 'Widget origin mismatch', 403);
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
          return reflectedErrorResponse(
            rawOrigin,
            'No private policy scope access for this user',
            403,
          );
        }
        effectivePolicyScope = scopeResolution.effectivePolicyScope;

        // Widget session issuance already verified `member` role for the user, but we
        // re-fetch here to obtain the fresh role set for capability enforcement. A
        // revocation between session issuance and chat invocation correctly denies.
        const roleCheck = await requireRole(claims.user_id, 'member');
        if (!roleCheck.ok) return roleCheck.response;

        // Enforce the chat KOS capability bundle (search + read:knowledge + ai:synthesis)
        // for the eigenx widget branch. Public widget mode is anonymous (rate-limited,
        // no caller roles) and is not enforced here — see slice 2b for that decision.
        const kos = await enforceEigenKosCapabilityBundle(client, {
          policyTags: effectivePolicyScope,
          requiredCapabilityTags: EIGEN_KOS_CAPABILITY.chat,
          callerRoles: roleCheck.roles,
          surface: 'eigen-widget-chat.eigenx',
          audit: {
            callerSubject: claims.user_id,
            correlationId: meta.correlationId,
            metadata: {
              mode: claims.mode,
              site_id: claims.site_id,
              response_format: body.response_format,
              conversation_intent: body.conversation_intent,
            },
          },
        });
        if (!kos.ok) {
          return new Response(JSON.stringify(buildEigenKosCapabilityDenialBody(kos.denial)), {
            status: 403,
            headers: { ...reflectedCorsHeaders(rawOrigin), 'Content-Type': 'application/json' },
          });
        }
      }

      const retreatScopedPublic = claims.mode === 'public' && claims.site_id === 'raysretreat';
      const r2AppScopedPublic = claims.mode === 'public' && claims.site_id === 'r2app';
      const outsideDomainIntent = inferOutsideDomainIntent(body.message);

      let effectiveEntityScope = claims.mode === 'eigenx' ? (body.entity_scope ?? []) : [];
      let entityScopeMode: EntityScopeMode = body.entity_scope_mode ?? 'filter';
      if (claims.mode === 'eigenx') {
        const resolvedEntityScope = await resolveChatEntityScope(client, {
          message: body.message,
          explicitScope: body.entity_scope ?? [],
          entityLabel: body.entity_label,
          entityScopeMode: body.entity_scope_mode,
        }).catch(() => ({
          entityIds: body.entity_scope ?? [],
          resolutionSources: (body.entity_scope ?? []).length > 0 ? (['explicit'] as const) : [],
          scopeMode: (body.entity_scope_mode ?? 'filter') as EntityScopeMode,
          lookupHits: [],
        }));
        effectiveEntityScope = resolvedEntityScope.entityIds;
        entityScopeMode = resolvedEntityScope.scopeMode;
      }

      const retrieveResult = await executeEigenRetrieve(client, {
        query: body.message,
        entity_scope: effectiveEntityScope,
        entity_scope_mode: claims.mode === 'eigenx' ? entityScopeMode : undefined,
        policy_scope: effectivePolicyScope,
        site_id: claims.site_id,
        site_source_systems: claims.site_source_systems,
        site_boost: retreatScopedPublic ? 0.7 : r2AppScopedPublic ? 0.6 : undefined,
        global_penalty: retreatScopedPublic ? -0.4 : r2AppScopedPublic ? -0.35 : undefined,
        site_relevance_min: retreatScopedPublic ? 0.36 : r2AppScopedPublic ? 0.3 : undefined,
        cross_source_max_ratio: retreatScopedPublic ? 0.2 : r2AppScopedPublic ? 0.15 : undefined,
        allow_cross_source_when_low_confidence: retreatScopedPublic,
        outside_domain_intent: outsideDomainIntent,
        disallowed_source_systems:
          (retreatScopedPublic &&
            body.conversation_intent === 'retreat_content' &&
            !outsideDomainIntent) ||
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
      if (!retrieveResult.ok)
        return reflectedErrorResponse(
          rawOrigin,
          `Retrieve failed: ${retrieveResult.message}`,
          retrieveResult.status,
        );

      const citations = buildCitations(retrieveResult.body.chunks);
      const confidence = buildCompositeConfidence(citations);
      const entityContext =
        claims.mode === 'eigenx'
          ? await fetchMegEntityContextForChat(client, effectiveEntityScope).catch(() => [])
          : [];
      const synthesis = await synthesize(
        client,
        claims.mode,
        effectivePolicyScope,
        body.message,
        retrieveResult.body.chunks,
        entityContext,
        body.response_format ?? 'structured',
        body.llm_provider,
        body.llm_model,
        confidence.overall,
      );
      return reflectedJsonResponse(rawOrigin, {
        response: synthesis.text,
        citations,
        confidence,
        entity_context_count: entityContext.length,
        entity_scope_applied: claims.mode === 'eigenx' ? effectiveEntityScope : [],
        entity_scope_mode: claims.mode === 'eigenx' ? entityScopeMode : null,
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
        headers: { ...reflectedCorsHeaders(rawOrigin), 'Content-Type': 'application/json' },
      });
    }
  }),
);
