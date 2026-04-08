import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import {
  executeEigenRetrieve,
  type EigenRetrieveChunk,
} from '../_shared/eigen-retrieve-core.ts';
import { POLICY_TAG_EIGENX } from '../_shared/eigen-policy.ts';

interface ChatRequest {
  message: string;
  session_id?: string;
  conversation_context?: 'auto' | 'none';
  response_format?: 'structured' | 'freeform';
  entity_scope?: string[];
  policy_scope?: string[];
  stream?: boolean;
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
}

function readMaxMessageChars(): number {
  const raw = Deno.env.get('EIGEN_CHAT_MAX_MESSAGE_CHARS') ?? '32000';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2000) return 32000;
  return Math.min(n, 200_000);
}

function readMaxCompletionTokens(): number {
  const raw = Deno.env.get('OPENAI_CHAT_MAX_TOKENS') ?? '1200';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 64) return 1200;
  return Math.min(n, 16_000);
}

function readDefaultPolicyScope(): string[] {
  const raw = Deno.env.get('EIGENX_DEFAULT_POLICY_SCOPE')?.trim();
  if (!raw) return [POLICY_TAG_EIGENX];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNoContextResponse(): string {
  return (
    Deno.env.get('EIGENX_NO_CONTEXT_RESPONSE')?.trim() ||
    'I do not have enough grounded knowledge to answer that yet.'
  );
}

function readSystemPrompt(format: 'structured' | 'freeform'): string {
  const fromEnv = Deno.env.get('EIGENX_SYSTEM_PROMPT')?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return format === 'structured'
    ? 'You are EigenX. Answer only from provided context. Include concise reasoning and avoid speculation.'
    : 'You are EigenX. Provide a concise grounded answer using only provided context.';
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

  return {
    message: body.message.trim(),
    session_id: typeof body.session_id === 'string' ? body.session_id : undefined,
    conversation_context: body.conversation_context === 'none' ? 'none' : 'auto',
    response_format: body.response_format === 'freeform' ? 'freeform' : 'structured',
    entity_scope: toList(body.entity_scope),
    policy_scope: (() => {
      const provided = toList(body.policy_scope);
      return provided.length > 0 ? provided : readDefaultPolicyScope();
    })(),
    stream: body.stream === true,
    budget_profile,
  };
}

function buildContextBlock(chunks: EigenRetrieveChunk[]): string {
  return chunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`).join('\n\n');
}

function buildFallbackAnswer(message: string, retrievedChunks: EigenRetrieveChunk[]): string {
  const top = retrievedChunks.slice(0, 3).map((chunk, index) => {
    return `${index + 1}. ${chunk.content.slice(0, 240)}`;
  });
  if (top.length === 0) {
    return 'No grounded knowledge was retrieved for this query.';
  }
  return `Grounded answer for "${message}":\n${top.join('\n')}`;
}

function buildCitations(chunks: EigenRetrieveChunk[]) {
  return chunks.slice(0, 8).map((chunk) => ({
    chunk_id: chunk.chunk_id,
    source:
      chunk.provenance?.source_ref ??
      chunk.provenance?.source_system ??
      'unknown',
    relevance: Number(chunk.composite_score?.toFixed(4) ?? chunk.similarity_score?.toFixed(4) ?? 0),
  }));
}

async function synthesizeResponse(
  message: string,
  retrievedChunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (retrievedChunks.length === 0) {
    return readNoContextResponse();
  }
  if (!apiKey) {
    return buildFallbackAnswer(message, retrievedChunks);
  }

  const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const context = buildContextBlock(retrievedChunks);
  const systemPrompt = readSystemPrompt(format);

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: readMaxCompletionTokens(),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Question: ${message}\n\nRetrieved context:\n${context}`,
        },
      ],
    }),
  });

  if (!completion.ok) {
    const text = await completion.text();
    throw new Error(`Chat completion failed: ${completion.status} ${text}`);
  }

  const payload = await completion.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('Chat completion returned empty content');
  return answer;
}

async function* streamOpenAiChatDeltas(
  message: string,
  context: string,
  format: 'structured' | 'freeform',
): AsyncGenerator<string, void, void> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('Streaming requires OPENAI_API_KEY');
  }

  const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const systemPrompt = readSystemPrompt(format);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: readMaxCompletionTokens(),
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Question: ${message}\n\nRetrieved context:\n${context}`,
        },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`Chat stream failed: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const segments = buffer.split('\n\n');
      buffer = segments.pop() ?? '';

      for (const segment of segments) {
        const line = segment.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const piece = json.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece.length > 0) {
            yield piece;
          }
        } catch {
          /* ignore malformed SSE payloads */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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
    const client = getServiceClient();

    let sessionId = body.session_id;
    if (!sessionId) {
      const sessionInsert = await client
        .from('eigen_chat_sessions')
        .insert([
          {
            owner_id: auth.claims.userId,
            title: body.message.slice(0, 80),
            entity_scope: body.entity_scope ?? [],
            policy_scope: body.policy_scope ?? [],
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
      budget_profile: body.budget_profile ?? { max_chunks: 12, max_tokens: 4000 },
      rerank: true,
      include_provenance: true,
    });

    if (!retrieveResult.ok) {
      return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);
    }

    const retrievedChunks = retrieveResult.body.chunks;
    const citations = buildCitations(retrievedChunks);
    const confidence: 'low' | 'medium' | 'high' =
      citations.length >= 6 ? 'high' : citations.length >= 3 ? 'medium' : 'low';

    if (body.stream) {
      const encoder = new TextEncoder();
      const context = buildContextBlock(retrievedChunks);
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
            const apiKey = Deno.env.get('OPENAI_API_KEY');

            if (retrievedChunks.length === 0) {
              fullText = readNoContextResponse();
              send({ text: fullText });
            } else if (!apiKey) {
              fullText = buildFallbackAnswer(body.message, retrievedChunks);
              send({ text: fullText });
            } else {
              for await (const delta of streamOpenAiChatDeltas(
                body.message,
                context,
                body.response_format ?? 'structured',
              )) {
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

    const responseText = await synthesizeResponse(
      body.message,
      retrievedChunks,
      body.response_format ?? 'structured',
    );

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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
