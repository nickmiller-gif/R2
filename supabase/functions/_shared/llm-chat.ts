import type { LlmProvider } from './eigen-chat-contract.ts';
import type { ConfidenceLabel } from './eigen-chat-contract.ts';

export interface LlmChatRequest {
  provider?: LlmProvider;
  model?: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature: number;
  critic?: {
    enabled?: boolean;
    confidence_label?: ConfidenceLabel;
    trigger_at?: ConfidenceLabel;
  };
}

export interface LlmChatResult {
  text: string;
  provider: LlmProvider;
  model: string;
  fallback_used: boolean;
  critic_used?: boolean;
  critic_provider?: LlmProvider;
  critic_model?: string;
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

function confidenceRank(value: ConfidenceLabel): number {
  if (value === 'low') return 0;
  if (value === 'medium') return 1;
  return 2;
}

function shouldRunCritic(critic: LlmChatRequest['critic']): boolean {
  if (!critic?.enabled) return false;
  if (!critic.confidence_label) return false;
  const triggerAt = critic.trigger_at ?? 'medium';
  return confidenceRank(critic.confidence_label) <= confidenceRank(triggerAt);
}

function resolveCriticProvider(primaryProvider: LlmProvider): LlmProvider | null {
  const preferred: LlmProvider[] = ['openai', 'anthropic'];
  for (const provider of preferred) {
    if (provider === primaryProvider) continue;
    if (apiKeyForProvider(provider)) return provider;
  }
  return null;
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

async function completeWithProvider(
  provider: LlmProvider,
  request: LlmChatRequest,
  model: string,
): Promise<string> {
  if (provider === 'openai') return completeOpenAi(request, model);
  if (provider === 'anthropic') return completeAnthropic(request, model);
  return completePerplexity(request, model);
}

export async function completeLlmChat(request: LlmChatRequest): Promise<LlmChatResult> {
  const { provider, fallbackUsed } = resolveProvider(request.provider);
  const model = request.model?.trim() || defaultModelForProvider(provider);
  let text = await completeWithProvider(provider, request, model);
  if (!text) throw new Error('LLM provider returned empty content');

  let criticUsed = false;
  let criticProvider: LlmProvider | undefined;
  let criticModel: string | undefined;
  if (shouldRunCritic(request.critic)) {
    const selectedCriticProvider = resolveCriticProvider(provider);
    if (selectedCriticProvider) {
      const selectedCriticModel = defaultModelForProvider(selectedCriticProvider);
      const criticPrompt = [
        'You are a response quality reviewer.',
        'Improve the draft for clarity and coherence, while preserving factual grounding.',
        'Do not introduce new facts not already present in context.',
        'Do not change the answer topic.',
      ].join(' ');
      const criticUserContent = [
        `Original user/context message:\n${request.userContent}`,
        `\nDraft answer:\n${text}`,
        '\nReturn only the revised answer text.',
      ].join('\n');
      try {
        const revised = await completeWithProvider(
          selectedCriticProvider,
          {
            ...request,
            provider: selectedCriticProvider,
            model: selectedCriticModel,
            systemPrompt: criticPrompt,
            userContent: criticUserContent,
            temperature: Math.min(0.4, Math.max(0, request.temperature)),
          },
          selectedCriticModel,
        );
        if (revised.trim().length > 0) {
          text = revised.trim();
          criticUsed = true;
          criticProvider = selectedCriticProvider;
          criticModel = selectedCriticModel;
        }
      } catch (_criticError) {
        // Fail-soft: keep primary answer if critic provider is unavailable.
      }
    }
  }
  return {
    text,
    provider,
    model,
    fallback_used: fallbackUsed,
    critic_used: criticUsed,
    critic_provider: criticProvider,
    critic_model: criticModel,
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
