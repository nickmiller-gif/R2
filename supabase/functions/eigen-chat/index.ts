import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';

interface ChatRequest {
  message: string;
  session_id?: string;
  conversation_context?: 'auto' | 'none';
  response_format?: 'structured' | 'freeform';
  entity_scope?: string[];
  policy_scope?: string[];
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
}

interface RetrieveChunk {
  chunk_id: string;
  content: string;
  chunk_level: string;
  similarity_score: number;
  composite_score: number;
  provenance?: {
    source_system?: string;
    source_ref?: string;
  };
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
    policy_scope: toList(body.policy_scope),
    budget_profile,
  };
}

async function synthesizeResponse(
  message: string,
  retrievedChunks: RetrieveChunk[],
  format: 'structured' | 'freeform',
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    const top = retrievedChunks.slice(0, 3).map((chunk, index) => {
      return `${index + 1}. ${chunk.content.slice(0, 240)}`;
    });
    if (top.length === 0) {
      return 'No grounded knowledge was retrieved for this query.';
    }
    return `Grounded answer for "${message}":\n${top.join('\n')}`;
  }

  const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const context = retrievedChunks
    .slice(0, 12)
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n');

  const systemPrompt =
    format === 'structured'
      ? 'You are Eigen Chat. Answer only from provided context. Include concise reasoning and avoid speculation.'
      : 'You are Eigen Chat. Provide a concise grounded answer using only provided context.';

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
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

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    const retrieveResponse = await fetch(`${supabaseUrl}/functions/v1/eigen-retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') ?? '',
      },
      body: JSON.stringify({
        query: body.message,
        entity_scope: body.entity_scope ?? [],
        policy_scope: body.policy_scope ?? [],
        budget_profile: body.budget_profile ?? { max_chunks: 12, max_tokens: 4000 },
        rerank: true,
        include_provenance: true,
      }),
    });

    if (!retrieveResponse.ok) {
      const text = await retrieveResponse.text();
      return errorResponse(`Retrieve call failed: ${text}`, 500);
    }

    const retrievePayload = await retrieveResponse.json() as {
      retrieval_run_id?: string;
      chunks?: RetrieveChunk[];
    };
    const retrievedChunks = retrievePayload.chunks ?? [];
    const responseText = await synthesizeResponse(
      body.message,
      retrievedChunks,
      body.response_format ?? 'structured',
    );

    const citations = retrievedChunks.slice(0, 8).map((chunk) => ({
      chunk_id: chunk.chunk_id,
      source:
        chunk.provenance?.source_ref ??
        chunk.provenance?.source_system ??
        'unknown',
      relevance: Number(chunk.composite_score?.toFixed(4) ?? chunk.similarity_score?.toFixed(4) ?? 0),
    }));

    const memoryUpsert = await client
      .from('memory_entries')
      .upsert(
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
      );
    if (memoryUpsert.error) return errorResponse(memoryUpsert.error.message, 400);

    const sessionUpdate = await client
      .from('eigen_chat_sessions')
      .update({
        last_retrieval_run_id: retrievePayload.retrieval_run_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('owner_id', auth.claims.userId);
    if (sessionUpdate.error) return errorResponse(sessionUpdate.error.message, 400);

    return jsonResponse({
      response: responseText,
      citations,
      confidence: citations.length >= 6 ? 'high' : citations.length >= 3 ? 'medium' : 'low',
      retrieval_run_id: retrievePayload.retrieval_run_id ?? null,
      memory_updated: true,
      session_id: sessionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
