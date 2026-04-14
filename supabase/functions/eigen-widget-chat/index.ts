import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { executeEigenRetrieve, type EigenRetrieveChunk } from '../_shared/eigen-retrieve-core.ts';
import { verifyWidgetSessionToken } from '../_shared/widget-session.ts';
import { resolveEigenxPolicyScope } from '../_shared/eigen-policy-access.ts';
import { POLICY_TAG_EIGENX } from '../_shared/eigen-policy.ts';
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
import { completeLlmChat } from '../_shared/llm-chat.ts';

interface WidgetChatRequest {
  widget_token: string;
  message: string;
  response_format?: 'structured' | 'freeform';
  llm_provider?: LlmProvider;
  llm_model?: string;
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
  mode: 'public' | 'eigenx',
  message: string,
  chunks: EigenRetrieveChunk[],
  format: 'structured' | 'freeform',
  llmProvider: LlmProvider | undefined,
  llmModel: string | undefined,
): Promise<string> {
  const hasContext = chunks.length > 0;

  const envPrompt = mode === 'public'
    ? Deno.env.get('EIGEN_PUBLIC_SYSTEM_PROMPT')
    : Deno.env.get('EIGENX_SYSTEM_PROMPT');
  const basePrompt = (envPrompt && envPrompt.trim()) || defaultWidgetSystemPrompt(mode, hasContext);
  const systemPrompt = withEigenChatProseStyle(basePrompt);

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
  });
  return result.text?.trim() || 'No response generated.';
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

    const responseText = await synthesize(
      claims.mode,
      body.message,
      retrieveResult.body.chunks,
      body.response_format ?? 'structured',
      body.llm_provider,
      body.llm_model,
    );
    const citations = buildCitations(retrieveResult.body.chunks);
    const confidence = buildCompositeConfidence(citations);
    return jsonResponse({
      response: responseText,
      citations,
      confidence,
      llm_provider: body.llm_provider ?? 'openai',
      llm_model: body.llm_model ?? null,
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
