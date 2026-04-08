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

async function synthesize(
  mode: 'public' | 'eigenx',
  message: string,
  chunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
): Promise<string> {
  if (chunks.length === 0) {
    return mode === 'public'
      ? 'I do not have enough grounded public-source information to answer that yet.'
      : 'I do not have enough grounded knowledge to answer that yet.';
  }
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return chunks.slice(0, 3).map((c, i) => `${i + 1}. ${c.content.slice(0, 220)}`).join('\n');
  }
  const model = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  const defaultPrompt = mode === 'public'
    ? 'You are Public Eigen. Answer only from retrieved public context; never speculate.'
    : 'You are EigenX. Answer only from retrieved context with concise reasoning.';
  const envPrompt = mode === 'public'
    ? Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')
    : Deno.env.get('EIGENX_SYSTEM_PROMPT');
  const systemPrompt = (envPrompt && envPrompt.trim()) || defaultPrompt;
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
        { role: 'user', content: `Question: ${message}\n\nRetrieved context:\n${buildContext(chunks)}` },
      ],
      max_tokens: format === 'freeform' ? 1200 : 900,
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
