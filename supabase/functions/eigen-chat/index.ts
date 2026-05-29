import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { resolveEffectiveEigenxScope } from '../_shared/eigenx-scope-resolver.ts';
import {
  EIGEN_RETRIEVED_CONTEXT_INTRO,
  EIGENX_DEFAULT_NO_CONTEXT_RESPONSE,
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
  type LlmProvider,
} from '../_shared/eigen-chat-contract.ts';
import { completeLlmChat, streamLlmChatDeltas } from '../_shared/llm-chat.ts';
import { loadRecentTurns, persistTurnPair } from '../_shared/eigen-chat-history.ts';
import {
  trimHistoryToBudget,
  type ConversationTurn,
} from '../../../src/lib/eigen/chat-history-utils.ts';
import { fetchRayVoiceStyleAddendum } from '../_shared/ray-voice-style.ts';
import { logError, logInfo } from '../_shared/log.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import {
  buildEigenKosCapabilityDenialBody,
  enforceEigenKosCapabilityBundle,
} from '../_shared/eigen-kos-enforcement.ts';
import {
  buildUserMessageWithEntityAndRetrievalContext,
  EIGEN_ENTITY_CONTEXT_INTRO,
  formatEntityContextForLlm,
  type ChatEntityForPrompt,
} from '../../../src/lib/eigen/chat-entity-context.ts';
import {
  EIGEN_GOVERNANCE_CONTEXT_INTRO,
  formatGovernanceContextForLlm,
} from '../../../src/lib/eigen/chat-governance-context.ts';
import { EIGEN_SESSION_MEMORY_INTRO } from '../../../src/lib/eigen/chat-session-memory.ts';
import { loadChatMemoryRecallForChat } from '../_shared/chat-memory-recall.ts';
import { resolveEigenRetrievalQualityFlags } from '../../../src/lib/eigen/retrieve-feature-flags.ts';
import {
  EIGEN_ORACLE_SIGNALS_INTRO,
  formatOracleSignalsForLlm,
} from '../../../src/lib/eigen/chat-oracle-signals-context.ts';
import { fetchOracleSignalsForEntityScope } from '../_shared/chat-oracle-signals.ts';
import {
  fetchMegEntityContextForChat,
  resolveChatEntityScope,
} from '../_shared/chat-entity-context.ts';
import { fetchGovernanceContextForChat } from '../_shared/chat-governance-context.ts';
import {
  sanitizeEntityLabel,
  normalizeEntityScopeFromRequest,
  type EntityScopeMode,
} from '../../../src/lib/eigen/chat-entity-resolver.ts';
import { normalizeEntityScopeIds } from '../../../src/lib/eigen/chat-entity-context.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EIGEN_KOS_CAPABILITY } from '../../../src/lib/eigen/eigen-kos-capabilities.ts';

interface ChatRequest {
  message: string;
  session_id?: string;
  conversation_context?: 'auto' | 'none';
  response_format?: 'structured' | 'freeform';
  entity_scope?: string[];
  entity_label?: string;
  entity_scope_mode?: EntityScopeMode;
  /** Resolved after auth; parseRequest may leave empty when client omitted policy_scope. */
  policy_scope: string[];
  policy_scope_explicit: boolean;
  site_id?: string;
  site_source_systems?: string[];
  site_boost?: number;
  global_penalty?: number;
  stream?: boolean;
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
  llm_provider?: LlmProvider;
  llm_model?: string;
  oracle_run_id?: string;
  charter_decision_id?: string;
  /** When true, resolve and persist entity scope only (no retrieve / LLM). Requires session_id. */
  scope_update?: boolean;
}

const supabaseClients = createSupabaseClientFactory();

function readMaxMessageChars(): number {
  const raw = Deno.env.get('EIGEN_CHAT_MAX_MESSAGE_CHARS') ?? '32000';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2000) return 32000;
  return Math.min(n, 200_000);
}

function readMaxCompletionTokens(): number {
  const raw =
    Deno.env.get('EIGEN_CHAT_MAX_TOKENS') ?? Deno.env.get('OPENAI_CHAT_MAX_TOKENS') ?? '1200';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 64) return 1200;
  return Math.min(n, 16_000);
}

/** Max conversation turns (user + assistant count) passed to the LLM; must be even. */
function readMaxHistoryTurns(): number {
  const raw = Deno.env.get('EIGEN_CHAT_MAX_HISTORY_TURNS') ?? '8';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2) return 8;
  const capped = Math.min(n, 20);
  return capped % 2 === 0 ? capped : capped - 1;
}

function readNoContextResponse(): string {
  return Deno.env.get('EIGENX_NO_CONTEXT_RESPONSE')?.trim() || EIGENX_DEFAULT_NO_CONTEXT_RESPONSE;
}

function readRetrievalQualityFlags() {
  return resolveEigenRetrievalQualityFlags({
    topTier: Deno.env.get('EIGEN_TOP_TIER_RETRIEVAL'),
    multiQuery: Deno.env.get('EIGEN_MULTI_QUERY_FUSION'),
    rerank: Deno.env.get('EIGEN_ENABLE_RERANKING'),
  });
}

function readEigenChatTemperature(): number {
  const raw = Deno.env.get('EIGEN_CHAT_TEMPERATURE') ?? '0.32';
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 0.32;
  return Math.min(1.2, Math.max(0, n));
}

function readSystemPrompt(hasContext: boolean, voiceAddendum = '', retrievalAppend = ''): string {
  const fromEnv = Deno.env.get('EIGENX_SYSTEM_PROMPT')?.trim();
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : defaultEigenxSystemPrompt(hasContext);
  return [
    withEigenChatProseStyle(base),
    'Primary domain corpus decides answer direction; secondary corpus is additive only.',
    voiceAddendum,
    retrievalAppend,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function parseRequest(value: unknown): ChatRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  const body = value as Record<string, unknown>;
  const scopeUpdate = body.scope_update === true;
  const rawMessage = typeof body.message === 'string' ? body.message : '';
  if (!scopeUpdate && rawMessage.trim().length === 0) {
    throw new Error('message is required');
  }
  if (scopeUpdate && (typeof body.session_id !== 'string' || body.session_id.trim().length === 0)) {
    throw new Error('session_id is required for scope_update');
  }

  const maxChars = readMaxMessageChars();
  if (rawMessage.length > maxChars) {
    throw new Error(`message exceeds maximum length (${maxChars} characters)`);
  }

  let budget_profile: ChatRequest['budget_profile'];
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

  const policyScopeList = toList(body.policy_scope);
  return {
    message: rawMessage.trim(),
    scope_update: scopeUpdate,
    session_id: typeof body.session_id === 'string' ? body.session_id : undefined,
    conversation_context: body.conversation_context === 'none' ? 'none' : 'auto',
    response_format: body.response_format === 'freeform' ? 'freeform' : 'structured',
    entity_scope: normalizeEntityScopeFromRequest(body.entity_scope),
    entity_label: sanitizeEntityLabel(
      typeof body.entity_label === 'string' ? body.entity_label : undefined,
    ),
    entity_scope_mode:
      body.entity_scope_mode === 'boost' || body.entity_scope_mode === 'filter'
        ? body.entity_scope_mode
        : undefined,
    policy_scope: policyScopeList,
    policy_scope_explicit: Object.prototype.hasOwnProperty.call(body, 'policy_scope'),
    stream: body.stream === true,
    site_id: typeof body.site_id === 'string' ? body.site_id.trim() : undefined,
    site_source_systems: toList(body.site_source_systems),
    site_boost: typeof body.site_boost === 'number' ? body.site_boost : undefined,
    global_penalty: typeof body.global_penalty === 'number' ? body.global_penalty : undefined,
    budget_profile,
    llm_provider:
      body.llm_provider === 'openai' ||
      body.llm_provider === 'anthropic' ||
      body.llm_provider === 'perplexity'
        ? (body.llm_provider as LlmProvider)
        : undefined,
    llm_model: typeof body.llm_model === 'string' ? body.llm_model.trim() : undefined,
    oracle_run_id: typeof body.oracle_run_id === 'string' ? body.oracle_run_id.trim() : undefined,
    charter_decision_id:
      typeof body.charter_decision_id === 'string' ? body.charter_decision_id.trim() : undefined,
  };
}

function buildUserMessageWithContext(
  message: string,
  chunks: EigenRetrieveChunk[],
  entityContext: ChatEntityForPrompt[],
  memoryIntro: string,
  sessionMemoryBlock: string,
  governanceBlock: string,
  oracleSignalsBlock: string,
): string {
  return buildUserMessageWithEntityAndRetrievalContext({
    message,
    entityIntro: EIGEN_ENTITY_CONTEXT_INTRO,
    entityBlock: formatEntityContextForLlm(entityContext),
    memoryIntro,
    memoryBlock: sessionMemoryBlock,
    governanceIntro: EIGEN_GOVERNANCE_CONTEXT_INTRO,
    governanceBlock,
    oracleSignalsIntro: EIGEN_ORACLE_SIGNALS_INTRO,
    oracleSignalsBlock,
    retrievalIntro: EIGEN_RETRIEVED_CONTEXT_INTRO,
    retrievalBlock: formatRetrievalContextForLlm(chunks),
  });
}

async function persistSessionEntityScope(
  client: SupabaseClient,
  sessionId: string,
  ownerId: string,
  entityScope: string[],
): Promise<void> {
  const normalized = normalizeEntityScopeIds(entityScope);
  const { error } = await client
    .from('eigen_chat_sessions')
    .update({ entity_scope: normalized, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('owner_id', ownerId);
  if (error) {
    logError('persistSessionEntityScope failed', {
      functionName: 'eigen-chat',
      error: error.message,
    });
  }
}

async function hydrateEntityScopeFromSession(
  client: SupabaseClient,
  sessionId: string | undefined,
  ownerId: string,
  entityScope: string[],
): Promise<string[]> {
  if (entityScope.length > 0 || !sessionId) return entityScope;
  const { data, error } = await client
    .from('eigen_chat_sessions')
    .select('entity_scope')
    .eq('id', sessionId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data?.entity_scope) return entityScope;
  return Array.isArray(data.entity_scope)
    ? normalizeEntityScopeIds(data.entity_scope.map((item) => String(item)))
    : entityScope;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;
    const roleCheck = await requireRole(auth.claims.userId, 'member');
    if (!roleCheck.ok) return roleCheck.response;

    try {
      const body = parseRequest(await req.json());
      const client = supabaseClients.service();
      const resolvedScope = await resolveEffectiveEigenxScope({
        client,
        userId: auth.claims.userId,
        roles: roleCheck.roles,
        explicitScope: body.policy_scope_explicit ? body.policy_scope : undefined,
      });
      if (resolvedScope.emptyAfterGrantIntersection) {
        return errorResponse('No private policy scope access for this user', 403);
      }
      body.policy_scope = resolvedScope.effectivePolicyScope;

      // Enforce the chat KOS capability bundle (search + read:knowledge + ai:synthesis)
      // for the caller's effective policy scope. Runs before the first retrieve so we
      // don't spend LLM tokens on a request that would fail at capability gating.
      // Opt into decision-audit recording: the bundle outcome lands in
      // `eigen_policy_decisions` so operators can answer "why was this chat
      // request allowed/denied" later. Best-effort — failure cannot block chat.
      const kos = await enforceEigenKosCapabilityBundle(client, {
        policyTags: resolvedScope.effectivePolicyScope,
        requiredCapabilityTags: EIGEN_KOS_CAPABILITY.chat,
        callerRoles: roleCheck.roles,
        surface: 'eigen-chat',
        audit: {
          callerSubject: auth.claims.userId,
          correlationId: meta.correlationId,
          metadata: {
            response_format: body.response_format,
            session_provided: typeof body.session_id === 'string' && body.session_id.length > 0,
            policy_scope_explicit: body.policy_scope_explicit,
          },
        },
      });
      if (!kos.ok) {
        return new Response(JSON.stringify(buildEigenKosCapabilityDenialBody(kos.denial)), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let sessionId = body.session_id;
      if (!sessionId) {
        if (body.scope_update) {
          return errorResponse('session_id is required for scope_update', 400);
        }
        const sessionInsert = await client
          .from('eigen_chat_sessions')
          .insert([
            {
              owner_id: auth.claims.userId,
              title: body.message.slice(0, 80) || 'Eigen chat',
              entity_scope: body.entity_scope ?? [],
              policy_scope: resolvedScope.effectivePolicyScope,
            },
          ])
          .select('id')
          .single();
        if (sessionInsert.error) return errorResponse(sessionInsert.error.message, 400);
        sessionId = sessionInsert.data.id as string;
      } else {
        const { data: existingSession, error: sessionLookupError } = await client
          .from('eigen_chat_sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('owner_id', auth.claims.userId)
          .maybeSingle();
        if (sessionLookupError) return errorResponse(sessionLookupError.message, 400);
        if (!existingSession) {
          return errorResponse('session_id not found or not owned by caller', 404);
        }
      }

      body.entity_scope = await hydrateEntityScopeFromSession(
        client,
        sessionId,
        auth.claims.userId,
        body.entity_scope ?? [],
      );

      const explicitScope = body.entity_scope ?? [];
      const resolvedEntityScope = await resolveChatEntityScope(client, {
        message: body.message,
        explicitScope,
        entityLabel: body.entity_label,
        entityScopeMode: body.entity_scope_mode,
      }).catch((err) => {
        logError('resolveChatEntityScope failed', {
          functionName: 'eigen-chat',
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          entityIds: explicitScope,
          resolutionSources: explicitScope.length > 0 ? (['explicit'] as const) : [],
          scopeMode: (body.entity_scope_mode ?? 'filter') as EntityScopeMode,
          lookupHits: [],
        };
      });
      body.entity_scope = resolvedEntityScope.entityIds;
      logInfo('chat entity scope resolved', {
        functionName: 'eigen-chat',
        correlationId: meta.correlationId,
        scope_mode: resolvedEntityScope.scopeMode,
        entity_count: resolvedEntityScope.entityIds.length,
        resolution_sources: resolvedEntityScope.resolutionSources,
        hint_count: resolvedEntityScope.lookupHits.length,
      });

      if (resolvedEntityScope.entityIds.length > 0) {
        await persistSessionEntityScope(
          client,
          sessionId,
          auth.claims.userId,
          resolvedEntityScope.entityIds,
        );
      }

      if (body.scope_update) {
        return jsonResponse({
          scope_update: true,
          session_id: sessionId,
          entity_scope_applied: resolvedEntityScope.entityIds,
          entity_scope_mode: resolvedEntityScope.scopeMode,
          entity_resolution_sources: resolvedEntityScope.resolutionSources,
        });
      }

      const retrievalFlags = readRetrievalQualityFlags();
      const retrieveResult = await executeEigenRetrieve(client, {
        query: body.message,
        entity_scope: body.entity_scope,
        entity_scope_mode: resolvedEntityScope.scopeMode,
        policy_scope: body.policy_scope ?? [],
        site_id: body.site_id,
        site_source_systems: body.site_source_systems ?? [],
        site_boost: body.site_boost,
        global_penalty: body.global_penalty,
        budget_profile: body.budget_profile
          ? {
              ...body.budget_profile,
              strata_weights: buildUploadFirstStrataWeights(body.budget_profile.strata_weights),
            }
          : { max_chunks: 12, max_tokens: 4000, strata_weights: buildUploadFirstStrataWeights() },
        rerank: true,
        enable_reranking: retrievalFlags.rerank,
        enable_multi_query: retrievalFlags.multiQuery,
        include_provenance: true,
      });

      if (!retrieveResult.ok) {
        return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);
      }

      const retrievedChunks = retrieveResult.body.chunks;
      const citations = buildCitations(retrievedChunks);
      const confidence = buildCompositeConfidence(citations);
      const [voiceStyleAddendum, entityContext, memoryRecall, governance, oracleSignals] =
        await Promise.all([
          fetchRayVoiceStyleAddendum(client, {
            message: body.message,
            includePrivate: true,
            policyScope: resolvedScope.effectivePolicyScope,
          }),
          fetchMegEntityContextForChat(client, body.entity_scope).catch((err) => {
            logError('fetchMegEntityContextForChat failed', {
              functionName: 'eigen-chat',
              error: err instanceof Error ? err.message : String(err),
            });
            return [] as ChatEntityForPrompt[];
          }),
          loadChatMemoryRecallForChat(
            client,
            sessionId,
            auth.claims.userId,
            body.entity_scope ?? [],
          ).catch((err) => {
            logError('loadChatMemoryRecallForChat failed', {
              functionName: 'eigen-chat',
              error: err instanceof Error ? err.message : String(err),
            });
            return {
              block: '',
              source: 'none' as const,
              intro: EIGEN_SESSION_MEMORY_INTRO,
            };
          }),
          fetchGovernanceContextForChat(client, {
            oracleRunId: body.oracle_run_id,
            charterDecisionId: body.charter_decision_id,
          }),
          fetchOracleSignalsForEntityScope(client, body.entity_scope).catch((err) => {
            logError('fetchOracleSignalsForEntityScope failed', {
              functionName: 'eigen-chat',
              error: err instanceof Error ? err.message : String(err),
            });
            return [];
          }),
        ]);
      const sessionMemoryBlock = memoryRecall.block;
      const memoryIntro = memoryRecall.intro || EIGEN_SESSION_MEMORY_INTRO;
      const governanceBlock = formatGovernanceContextForLlm(governance);
      const oracleSignalsBlock = formatOracleSignalsForLlm(oracleSignals);
      const retrievalQualityAppend = eigenRetrievalQualityAppend(
        retrievedChunks,
        confidence.overall,
      );
      const hasAnswerContext =
        retrievedChunks.length > 0 ||
        entityContext.length > 0 ||
        sessionMemoryBlock.length > 0 ||
        governanceBlock.length > 0 ||
        oracleSignalsBlock.length > 0;

      const maxHistoryTurns = readMaxHistoryTurns();
      let conversationHistory: ConversationTurn[] = [];
      if (body.conversation_context !== 'none') {
        const rawTurns = await loadRecentTurns(
          client,
          sessionId,
          auth.claims.userId,
          maxHistoryTurns,
        );
        conversationHistory = trimHistoryToBudget(rawTurns, maxHistoryTurns);
      }

      if (body.stream) {
        const encoder = new TextEncoder();
        const streamUserContent = buildUserMessageWithContext(
          body.message,
          retrievedChunks,
          entityContext,
          memoryIntro,
          sessionMemoryBlock,
          governanceBlock,
          oracleSignalsBlock,
        );
        const sseHeaders = {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
        };

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (obj: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            };

            try {
              let fullText = '';
              let providerUsed: LlmProvider | undefined;
              let modelUsed: string | null = null;
              let fallbackUsed = false;
              let criticUsed = false;
              let criticProvider: LlmProvider | undefined;
              let criticModel: string | undefined;

              const generationStartedAt = Date.now();
              if (!hasAnswerContext) {
                fullText = readNoContextResponse();
                send({ text: fullText });
              } else {
                const stream = streamLlmChatDeltas({
                  provider: body.llm_provider,
                  model: body.llm_model,
                  systemPrompt: readSystemPrompt(
                    hasAnswerContext,
                    voiceStyleAddendum,
                    retrievalQualityAppend,
                  ),
                  userContent: streamUserContent,
                  conversationHistory,
                  maxTokens: readMaxCompletionTokens(),
                  temperature: readEigenChatTemperature(),
                  critic: {
                    enabled: true,
                    confidence_label: confidence.overall,
                    trigger_at: 'medium',
                  },
                });
                while (true) {
                  const step = await stream.next();
                  if (step.done) {
                    providerUsed = step.value.provider;
                    modelUsed = step.value.model;
                    fallbackUsed = step.value.fallback_used;
                    criticUsed = step.value.critic_used === true;
                    criticProvider = step.value.critic_provider;
                    criticModel = step.value.critic_model;
                    break;
                  }
                  const delta = step.value;
                  fullText += delta;
                  send({ text: delta });
                }
              }
              const turnLatencyMs = Math.max(0, Date.now() - generationStartedAt);

              const [memoryUpsert, sessionUpdate] = await Promise.all([
                client.from('memory_entries').upsert(
                  [
                    {
                      scope: 'session',
                      key: `chat:last_turn:${sessionId}`,
                      value: {
                        message: body.message,
                        response: fullText,
                        citations,
                        timestamp: new Date().toISOString(),
                      },
                      retention_class: 'short_term',
                      owner_id: auth.claims.userId,
                      confidence_band: 'high',
                    },
                  ],
                  { onConflict: 'scope,owner_id,key' },
                ),
                client
                  .from('eigen_chat_sessions')
                  .update({
                    last_retrieval_run_id: retrieveResult.body.retrieval_run_id ?? null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', sessionId)
                  .eq('owner_id', auth.claims.userId),
              ]);

              if (memoryUpsert.error) {
                send({ error: memoryUpsert.error.message });
                return;
              }
              if (sessionUpdate.error) {
                send({ error: sessionUpdate.error.message });
                return;
              }

              const usedLlmForTurn = hasAnswerContext;
              const resolvedLlmProvider = usedLlmForTurn
                ? (providerUsed ?? body.llm_provider ?? 'openai')
                : null;
              const resolvedLlmModel = usedLlmForTurn
                ? (modelUsed ?? body.llm_model ?? null)
                : null;
              const resolvedLlmFallbackUsed = usedLlmForTurn ? fallbackUsed : false;
              const resolvedLlmCriticUsed = usedLlmForTurn ? criticUsed : false;

              const persistResult = await persistTurnPair(client, {
                sessionId,
                ownerId: auth.claims.userId,
                userMessage: body.message,
                assistantMessage: fullText,
                retrievalRunId: retrieveResult.body.retrieval_run_id ?? null,
                citations,
                confidence,
                llmProvider: resolvedLlmProvider,
                llmModel: resolvedLlmModel,
                llmFallbackUsed: resolvedLlmFallbackUsed,
                llmCriticUsed: resolvedLlmCriticUsed,
                latencyMs: turnLatencyMs,
              });
              if (!persistResult.ok) {
                logError('persistTurnPair failed', {
                  functionName: 'eigen-chat',
                  error: persistResult.error,
                });
              }

              send({
                done: true,
                response: fullText,
                citations,
                confidence,
                retrieval_run_id: retrieveResult.body.retrieval_run_id ?? null,
                memory_updated: true,
                session_id: sessionId,
                llm_provider: resolvedLlmProvider,
                llm_model: resolvedLlmModel,
                llm_fallback_used: resolvedLlmFallbackUsed,
                llm_critic_used: resolvedLlmCriticUsed,
                llm_critic_provider: criticProvider ?? null,
                llm_critic_model: criticModel ?? null,
                effective_policy_scope: resolvedScope.effectivePolicyScope,
                entity_scope_applied: resolvedEntityScope.entityIds,
                entity_scope_mode: resolvedEntityScope.scopeMode,
                entity_resolution_sources: resolvedEntityScope.resolutionSources,
                entity_context_count: entityContext.length,
              });
            } catch (streamErr) {
              const msg = streamErr instanceof Error ? streamErr.message : 'Unknown error';
              send({ error: msg });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, { headers: sseHeaders });
      }

      let responseText = '';
      let llmProvider: LlmProvider = body.llm_provider ?? 'openai';
      let llmModel: string | null = body.llm_model ?? null;
      let llmFallbackUsed = false;
      let llmCriticUsed = false;
      let llmCriticProvider: LlmProvider | null = null;
      let llmCriticModel: string | null = null;

      const nonStreamGenerationStartedAt = Date.now();
      if (!hasAnswerContext) {
        responseText = readNoContextResponse();
      } else {
        const llmResult = await completeLlmChat({
          provider: body.llm_provider,
          model: body.llm_model,
          systemPrompt: readSystemPrompt(
            hasAnswerContext,
            voiceStyleAddendum,
            retrievalQualityAppend,
          ),
          userContent: buildUserMessageWithContext(
            body.message,
            retrievedChunks,
            entityContext,
            memoryIntro,
            sessionMemoryBlock,
            governanceBlock,
            oracleSignalsBlock,
          ),
          conversationHistory,
          maxTokens: readMaxCompletionTokens(),
          temperature: readEigenChatTemperature(),
          critic: {
            enabled: true,
            confidence_label: confidence.overall,
            trigger_at: 'medium',
          },
        });
        responseText = llmResult.text;
        llmProvider = llmResult.provider;
        llmModel = llmResult.model;
        llmFallbackUsed = llmResult.fallback_used;
        llmCriticUsed = llmResult.critic_used === true;
        llmCriticProvider = llmResult.critic_provider ?? null;
        llmCriticModel = llmResult.critic_model ?? null;
      }
      const nonStreamTurnLatencyMs = Math.max(0, Date.now() - nonStreamGenerationStartedAt);

      const [memoryUpsert, sessionUpdate] = await Promise.all([
        client.from('memory_entries').upsert(
          [
            {
              scope: 'session',
              key: `chat:last_turn:${sessionId}`,
              value: {
                message: body.message,
                response: responseText,
                citations,
                timestamp: new Date().toISOString(),
              },
              retention_class: 'short_term',
              owner_id: auth.claims.userId,
              confidence_band: 'high',
            },
          ],
          { onConflict: 'scope,owner_id,key' },
        ),
        client
          .from('eigen_chat_sessions')
          .update({
            last_retrieval_run_id: retrieveResult.body.retrieval_run_id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('owner_id', auth.claims.userId),
      ]);

      if (memoryUpsert.error) return errorResponse(memoryUpsert.error.message, 400);
      if (sessionUpdate.error) return errorResponse(sessionUpdate.error.message, 400);

      const persistNonStream = await persistTurnPair(client, {
        sessionId,
        ownerId: auth.claims.userId,
        userMessage: body.message,
        assistantMessage: responseText,
        retrievalRunId: retrieveResult.body.retrieval_run_id ?? null,
        citations,
        confidence,
        llmProvider: !hasAnswerContext ? null : llmProvider,
        llmModel: !hasAnswerContext ? null : llmModel,
        llmFallbackUsed: !hasAnswerContext ? false : llmFallbackUsed,
        llmCriticUsed: !hasAnswerContext ? false : llmCriticUsed,
        latencyMs: nonStreamTurnLatencyMs,
      });
      if (!persistNonStream.ok) {
        logError('persistTurnPair failed', {
          functionName: 'eigen-chat',
          error: persistNonStream.error,
        });
      }

      return jsonResponse({
        response: responseText,
        citations,
        confidence,
        retrieval_run_id: retrieveResult.body.retrieval_run_id ?? null,
        memory_updated: true,
        session_id: sessionId,
        llm_provider: llmProvider,
        llm_model: llmModel,
        llm_fallback_used: llmFallbackUsed,
        llm_critic_used: llmCriticUsed,
        llm_critic_provider: llmCriticProvider,
        llm_critic_model: llmCriticModel,
        effective_policy_scope: resolvedScope.effectivePolicyScope,
        entity_scope_applied: resolvedEntityScope.entityIds,
        entity_scope_mode: resolvedEntityScope.scopeMode,
        entity_resolution_sources: resolvedEntityScope.resolutionSources,
        entity_context_count: entityContext.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
