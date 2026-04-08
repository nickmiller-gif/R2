import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { POLICY_TAG_EIGEN_PUBLIC } from '../_shared/eigen-policy.ts';
import { enforceEigenPublicRateLimit } from '../_shared/public-rate-limit.ts';

interface PublicChatRequest {
  message: string;
  response_format?: 'structured' | 'freeform';
  site_id?: string;
  site_source_systems?: string[];
  site_boost?: number;
  global_penalty?: number;
  budget_profile?: {
    max_chunks?: number;
    max_tokens?: number;
    strata_weights?: Record<string, number>;
  };
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
    site_id: typeof body.site_id === 'string' ? body.site_id.trim() : undefined,
    site_source_systems: Array.isArray(body.site_source_systems)
      ? body.site_source_systems.map((item) => String(item))
      : [],
    site_boost: typeof body.site_boost === 'number' ? body.site_boost : undefined,
    global_penalty: typeof body.global_penalty === 'number' ? body.global_penalty : undefined,
    budget_profile,
  };
}

function buildContextBlock(chunks: EigenRetrieveChunk[]): string {
  return chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n');
}

function buildCitations(chunks: EigenRetrieveChunk[]) {
  return chunks.slice(0, 8).map((chunk) => ({
    chunk_id: chunk.chunk_id,
    source: chunk.provenance?.source_ref ?? chunk.provenance?.source_system ?? 'unknown',
    relevance: Number(chunk.composite_score?.toFixed(4) ?? chunk.similarity_score?.toFixed(4) ?? 0),
  }));
}

function defaultPublicPrompt(format: 'structured' | 'freeform'): string {
  if (format === 'freeform') {
    return [
      'You are Public Eigen, the public-facing assistant for Ray.',
      'Use ONLY the provided retrieved context.',
      'If context is insufficient, say clearly that you do not have enough grounded public information.',
      'Keep tone warm and direct in Ray style, but never invent facts.',
    ].join(' ');
  }
  return [
    'You are Public Eigen, the public-facing assistant for Ray.',
    'Answer only from retrieved context and include concise factual reasoning.',
    'If evidence is missing, refuse to speculate and state that grounded public information is unavailable.',
    'Keep voice practical and founder-like, but factual.',
  ].join(' ');
}

async function synthesizePublicResponse(
  message: string,
  retrievedChunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
): Promise<string> {
  if (retrievedChunks.length === 0) {
    return 'I do not have enough grounded public-source information to answer that yet.';
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return retrievedChunks
      .slice(0, 3)
      .map((chunk, index) => `${index + 1}. ${chunk.content.slice(0, 240)}`)
      .join('\n');
  }

  const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const systemPrompt = Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT') ?? defaultPublicPrompt(format);
  const context = buildContextBlock(retrievedChunks);

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
          content: `Question: ${message}\n\nRetrieved public context:\n${context}`,
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
    const retrieveResult = await executeEigenRetrieve(client, {
      query: body.message,
      entity_scope: [],
      policy_scope: [POLICY_TAG_EIGEN_PUBLIC],
      site_id: body.site_id,
      site_source_systems: body.site_source_systems ?? [],
      site_boost: body.site_boost,
      global_penalty: body.global_penalty,
      budget_profile: body.budget_profile ?? { max_chunks: 10, max_tokens: 3000 },
      rerank: true,
      include_provenance: true,
    });

    if (!retrieveResult.ok) {
      return errorResponse(`Retrieve failed: ${retrieveResult.message}`, retrieveResult.status);
    }

    const responseText = await synthesizePublicResponse(
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
});
