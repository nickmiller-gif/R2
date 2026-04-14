import type { LlmProvider } from './eigen-chat-contract.ts';

export interface LlmChatRequest {
  provider?: LlmProvider;
  model?: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmChatResult {
  text: string;
  provider: LlmProvider;
  model: string;
  fallback_used: boolean;
}

const DEFAULT_PROVIDER: LlmProvider =
  (Deno.env.get('EIGEN_CHAT_DEFAULT_PROVIDER') as LlmProvider | null) ?? 'openai';

const PROVIDER_ORDER: LlmProvider[] = ['openai', 'anthropic', 'perplexity'];

function apiKeyForProvider(provider: LlmProvider): string | null {
  if (provider === 'openai') return Deno.env.get('OPENAI_API_KEY') ?? null;
  if (provider === 'anthropic') return Deno.env.get('ANTHROPIC_API_KEY') ?? null;
  return Deno.env.get('PERPLEXITY_API_KEY') ?? null;
}

function defaultModelForProvider(provider: LlmProvider): string {
  if (provider === 'openai') return Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  if (provider === 'anthropic') return Deno.env.get('ANTHROPIC_CHAT_MODEL') ?? 'claude-3-5-sonnet-latest';
  return Deno.env.get('PERPLEXITY_CHAT_MODEL') ?? 'sonar';
}

function resolveProvider(requested?: LlmProvider): { provider: LlmProvider; fallbackUsed: boolean } {
  const firstChoice = requested ?? DEFAULT_PROVIDER;
  const ordered = [firstChoice, ...PROVIDER_ORDER.filter((p) => p !== firstChoice)];
  for (let idx = 0; idx < ordered.length; idx += 1) {
    const provider = ordered[idx]!;
    if (apiKeyForProvider(provider)) {
      return { provider, fallbackUsed: idx > 0 };
    }
  }
  return { provider: firstChoice, fallbackUsed: false };
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = 45000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function completeOpenAi(request: LlmChatRequest, model: string): Promise<string> {
  const apiKey = apiKeyForProvider('openai');
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  const response = await fetchJsonWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userContent },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI chat failed (${response.status}): ${await response.text()}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

async function completeAnthropic(request: LlmChatRequest, model: string): Promise<string> {
  const apiKey = apiKeyForProvider('anthropic');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');
  const response = await fetchJsonWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userContent }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic chat failed (${response.status}): ${await response.text()}`);
  }
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = (payload.content ?? [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('');
  return text.trim();
}

async function completePerplexity(request: LlmChatRequest, model: string): Promise<string> {
  const apiKey = apiKeyForProvider('perplexity');
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY is missing');
  const response = await fetchJsonWithTimeout('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userContent },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Perplexity chat failed (${response.status}): ${await response.text()}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function completeLlmChat(request: LlmChatRequest): Promise<LlmChatResult> {
  const { provider, fallbackUsed } = resolveProvider(request.provider);
  const model = request.model?.trim() || defaultModelForProvider(provider);
  let text = '';
  if (provider === 'openai') text = await completeOpenAi(request, model);
  if (provider === 'anthropic') text = await completeAnthropic(request, model);
  if (provider === 'perplexity') text = await completePerplexity(request, model);
  if (!text) throw new Error('LLM provider returned empty content');
  return {
    text,
    provider,
    model,
    fallback_used: fallbackUsed,
  };
}

export async function* streamLlmChatDeltas(request: LlmChatRequest): AsyncGenerator<string, LlmChatResult, void> {
  const result = await completeLlmChat(request);
  const words = result.text.split(/(\s+)/).filter(Boolean);
  for (const piece of words) {
    yield piece;
  }
  return result;
}
