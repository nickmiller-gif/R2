import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import {
  executeEigenRetrieve,
  type EigenRetrieveChunk,
} from '../_shared/eigen-retrieve-core.ts';
import { resolveEigenxPolicyScope } from '../_shared/eigen-policy-access.ts';
import {
  clampExplicitEigenxPolicyScope,
  defaultEigenxRetrievePolicyScope,
  readEigenxEnvDefaultPolicyScope,
} from '../_shared/eigenx-scope.ts';
import {
  EIGEN_RETRIEVED_CONTEXT_INTRO,
  withEigenChatProseStyle,
} from '../_shared/eigen-chat-answer-style.ts';
import {
  buildCitations,
  buildCompositeConfidence,
  buildUploadFirstStrataWeights,
  type LlmProvider,
} from '../_shared/eigen-chat-contract.ts';
import { completeLlmChat, streamLlmChatDeltas } from '../_shared/llm-chat.ts';

interface ChatRequest {
  message: string;
  session_id?: string;
  conversation_context?: 'auto' | 'none';
  response_format?: 'structured' | 'freeform';
  entity_scope?: string[];
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
}

const supabaseClients = createSupabaseClientFactory();

function readMaxMessageChars(): number {
  const raw = Deno.env.get('EIGEN_CHAT_MAX_MESSAGE_CHARS') ?? '32000';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2000) return 32000;
  return Math.min(n, 200_000);
}

function readMaxCompletionTokens(): number {
  const raw = Deno.env.get('EIGEN_CHAT_MAX_TOKENS') ?? Deno.env.get('OPENAI_CHAT_MAX_TOKENS') ?? '1200';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 64) return 1200;
  return Math.min(n, 16_000);
}

function readNoContextResponse(): string {
  return (
    Deno.env.get('EIGENX_NO_CONTEXT_RESPONSE')?.trim() ||
    'I do not have enough grounded knowledge to answer that yet.'
  );
}

function readSystemPrompt(format: 'structured' | 'freeform'): string {
  const fromEnv = Deno.env.get('EIGENX_SYSTEM_PROMPT')?.trim();
  const base =
    fromEnv && fromEnv.length > 0
      ? fromEnv
      : format === 'structured'
        ? 'You are EigenX. Answer only from provided context. Include concise reasoning and avoid speculation.'
        : 'You are EigenX. Provide a concise grounded answer using only provided context.';
  return withEigenChatProseStyle(base);
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function parseRequest(value: unknown): ChatRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  const body = value as Record<string, unknown>;
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new Error('message is required');
  }

  const maxChars = readMaxMessageChars();
  if (body.message.length > maxChars) {
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
    message: body.message.trim(),
    session_id: typeof body.session_id === 'string' ? body.session_id : undefined,
    conversation_context: body.conversation_context === 'none' ? 'none' : 'auto',
    response_format: body.response_format === 'freeform' ? 'freeform' : 'structured',
    entity_scope: toList(body.entity_scope),
    policy_scope: policyScopeList,
    policy_scope_explicit: policyScopeList.length > 0,
    stream: body.stream === true,
    site_id: typeof body.site_id === 'string' ? body.site_id.trim() : undefined,
    site_source_systems: toList(body.site_source_systems),
    site_boost: typeof body.site_boost === 'number' ? body.site_boost : undefined,
    global_penalty: typeof body.global_penalty === 'number' ? body.global_penalty : undefined,
    budget_profile,
    llm_provider:
      body.llm_provider === 'openai' || body.llm_provider === 'anthropic' || body.llm_provider === 'perplexity'
        ? (body.llm_provider as LlmProvider)
        : undefined,
    llm_model: typeof body.llm_model === 'string' ? body.llm_model.trim() : undefined,
    oracle_run_id: typeof body.oracle_run_id === 'string' ? body.oracle_run_id.trim() : undefined,
    charter_decision_id: typeof body.charter_decision_id === 'string' ? body.charter_decision_id.trim() : undefined,
  };
}

function buildContextBlock(chunks: EigenRetrieveChunk[]): string {
  return chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join('\n\n');
}

function buildContextHandlesMessage(body: ChatRequest): string {
  const handles: string[] = [];
  if (body.oracle_run_id) handles.push(`oracle_run_id=${body.oracle_run_id}`);
  if (body.charter_decision_id) handles.push(`charter_decision_id=${body.charter_decision_id}`);
  if (!handles.length) return '';
  return `\n\nLinked governance context handles:\n- ${handles.join('\n- ')}`;
}

function buildUserMessageWithContext(
  message: string,
  chunks: EigenRetrieveChunk[],
  body: ChatRequest,
): string {
  return `Question: ${message}\n\n${EIGEN_RETRIEVED_CONTEXT_INTRO}\n${buildContextBlock(chunks)}${buildContextHandlesMessage(body)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;
  const roleCheck = await requireRole(auth.claims.userId, 'member');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = parseRequest(await req.json());
    const client = supabaseClients.service();
    const preScope = body.policy_scope_explicit
      ? clampExplicitEigenxPolicyScope(auth.claims.userId, roleCheck.roles, body.policy_scope)
      : defaultEigenxRetrievePolicyScope(auth.claims.userId, roleCheck.roles);
    const resolvedScope = await resolveEigenxPolicyScope(client, {
      userId: auth.claims.userId,
      requestedPolicyScope: preScope,
      defaultPolicyScope: readEigenxEnvDefaultPolicyScope(),
    });
    if (resolvedScope.grantsConfigured && resolvedScope.effectivePolicyScope.length === 0) {
      return errorResponse('No private policy scope access for this user', 403);
    }
    body.policy_scope = resolvedScope.effectivePolicyScope;

    let sessionId = body.session_id;
    if (!sessionId) {
      const sessionInsert = await client
        .from('eigen_chat_sessions')
        .insert([
          {
            owner_id: auth.claims.userId,
            title: body.message.slice(0, 80),
            entity_scope: body.entity_scope ?? [],
            policy_scope: resolvedScope.effectivePolicyScope,
          },
        ])
        .select('id')
        .single();
      if (sessionInsert.error) return errorResponse(sessionInsert.error.message, 400);
      sessionId = sessionInsert.data.id as string;
    }

    const retrieveResult = await executeEigenRetrieve(client, {
      query: body.message,
      entity_scope: body.entity_scope ?? [],
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
      include_provenance: true,
    });

    if (!retrieveResult.ok) {
      return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);
    }

    const retrievedChunks = retrieveResult.body.chunks;
    const citations = buildCitations(retrievedChunks);
    const confidence = buildCompositeConfidence(citations);

    if (body.stream) {
      const encoder = new TextEncoder();
      const streamUserContent = buildUserMessageWithContext(body.message, retrievedChunks, body);
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

            if (retrievedChunks.length === 0) {
              fullText = readNoContextResponse();
              send({ text: fullText });
            } else {
              const stream = streamLlmChatDeltas({
                provider: body.llm_provider,
                model: body.llm_model,
                systemPrompt: readSystemPrompt(body.response_format ?? 'structured'),
                userContent: streamUserContent,
                maxTokens: readMaxCompletionTokens(),
                temperature: 0.1,
              });
              while (true) {
                const step = await stream.next();
                if (step.done) {
                  providerUsed = step.value.provider;
                  modelUsed = step.value.model;
                  fallbackUsed = step.value.fallback_used;
                  break;
                }
                const delta = step.value;
                fullText += delta;
                send({ text: delta });
              }
            }

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

            send({
              done: true,
              response: fullText,
              citations,
              confidence,
              retrieval_run_id: retrieveResult.body.retrieval_run_id ?? null,
              memory_updated: true,
              session_id: sessionId,
              llm_provider: providerUsed ?? body.llm_provider ?? 'openai',
              llm_model: modelUsed ?? body.llm_model ?? null,
              llm_fallback_used: fallbackUsed,
              effective_policy_scope: resolvedScope.effectivePolicyScope,
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

    if (retrievedChunks.length === 0) {
      responseText = readNoContextResponse();
    } else {
      const llmResult = await completeLlmChat({
        provider: body.llm_provider,
        model: body.llm_model,
        systemPrompt: readSystemPrompt(body.response_format ?? 'structured'),
        userContent: buildUserMessageWithContext(body.message, retrievedChunks, body),
        maxTokens: readMaxCompletionTokens(),
        temperature: 0.1,
      });
      responseText = llmResult.text;
      llmProvider = llmResult.provider;
      llmModel = llmResult.model;
      llmFallbackUsed = llmResult.fallback_used;
    }

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
      effective_policy_scope: resolvedScope.effectivePolicyScope,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
