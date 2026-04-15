import type { LlmProvider } from './eigen-chat-contract.ts';
import type { ConfidenceLabel } from './eigen-chat-contract.ts';
import type { ConversationTurn } from '../../../src/lib/eigen/chat-history-utils.ts';

export type { ConversationTurn };

export interface LlmChatRequest {
  provider?: LlmProvider;
  model?: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature: number;
  /** Prior conversation turns to include as multi-turn context (oldest first). */
  conversationHistory?: ConversationTurn[];
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
const DEFAULT_STREAM_TIMEOUT_MS =
  Number.parseInt(Deno.env.get('LLM_STREAM_TIMEOUT_MS') ?? '', 10) || 120_000;

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

function sanitizeConversationHistory(history?: ConversationTurn[]): ConversationTurn[] {
  if (!history) return [];
  return history
    .filter(
      (turn): turn is ConversationTurn =>
        Boolean(turn) && (turn.role === 'user' || turn.role === 'assistant'),
    )
    .map((turn) => ({ role: turn.role, content: turn.content }));
}

async function fetchWithStreamTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_STREAM_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildOpenAiMessages(
  request: LlmChatRequest,
): Array<{ role: string; content: string }> {
  const history = sanitizeConversationHistory(request.conversationHistory);
  return [
    { role: 'system', content: request.systemPrompt },
    ...history,
    { role: 'user', content: request.userContent },
  ];
}

function buildAnthropicMessages(
  request: LlmChatRequest,
): Array<{ role: string; content: string }> {
  const history = sanitizeConversationHistory(request.conversationHistory);
  return [...history, { role: 'user', content: request.userContent }];
}

async function completeOpenAi(request: LlmChatRequest, model: string): Promise<string> {
  const apiKey = apiKeyForProvider('openai');
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  const response = await fetchWithStreamTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: buildOpenAiMessages(request),
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
  const response = await fetchWithStreamTimeout('https://api.anthropic.com/v1/messages', {
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
      messages: buildAnthropicMessages(request),
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
  const response = await fetchWithStreamTimeout('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      messages: buildOpenAiMessages(request),
    }),
  });
  if (!response.ok) {
    throw new Error(`Perplexity chat failed (${response.status}): ${await response.text()}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Streams tokens from an OpenAI-compatible SSE endpoint (OpenAI, Perplexity).
 * Yields each text delta as it arrives from the provider.
 */
async function* streamOpenAiCompatibleDeltas(
  url: string,
  headers: Record<string, string>,
  request: LlmChatRequest,
  model: string,
  messages: Array<{ role: string; content: string }>,
): AsyncGenerator<string, void, void> {
  const response = await fetchWithStreamTimeout(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Streaming request failed (${response.status}): ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from provider');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) yield delta;
        } catch {
          // Skip malformed SSE lines.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Streams tokens from Anthropic's messages SSE endpoint.
 * Yields each text_delta as it arrives from the provider.
 */
async function* streamAnthropicDeltas(
  request: LlmChatRequest,
  model: string,
): AsyncGenerator<string, void, void> {
  const apiKey = apiKeyForProvider('anthropic');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');

  const response = await fetchWithStreamTimeout('https://api.anthropic.com/v1/messages', {
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
      stream: true,
      system: request.systemPrompt,
      messages: buildAnthropicMessages(request),
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic streaming failed (${response.status}): ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from Anthropic');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        try {
          const parsed = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta' &&
            parsed.delta.text
          ) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip malformed SSE lines.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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

async function applyCriticIfNeeded(
  request: LlmChatRequest,
  primaryProvider: LlmProvider,
  draft: string,
): Promise<{
  text: string;
  criticUsed: boolean;
  criticProvider?: LlmProvider;
  criticModel?: string;
}> {
  if (!shouldRunCritic(request.critic)) {
    return { text: draft, criticUsed: false };
  }

  const selectedCriticProvider = resolveCriticProvider(primaryProvider);
  if (!selectedCriticProvider) {
    return { text: draft, criticUsed: false };
  }

  const selectedCriticModel = defaultModelForProvider(selectedCriticProvider);
  const criticPrompt = [
    'You are a response quality reviewer.',
    'Improve the draft for clarity and coherence, while preserving factual grounding.',
    'Do not introduce new facts not already present in context.',
    'Do not change the answer topic.',
  ].join(' ');
  const criticUserContent = [
    `Original user/context message:\n${request.userContent}`,
    `\nDraft answer:\n${draft}`,
    '\nReturn only the revised answer text.',
  ].join('\n');

  try {
    const revised = await completeWithProvider(
      selectedCriticProvider,
      {
        ...request,
        conversationHistory: undefined,
        provider: selectedCriticProvider,
        model: selectedCriticModel,
        systemPrompt: criticPrompt,
        userContent: criticUserContent,
        temperature: Math.min(0.4, Math.max(0, request.temperature)),
      },
      selectedCriticModel,
    );
    const trimmed = revised.trim();
    if (trimmed.length > 0) {
      return {
        text: trimmed,
        criticUsed: true,
        criticProvider: selectedCriticProvider,
        criticModel: selectedCriticModel,
      };
    }
  } catch (_criticError) {
    // Fail-soft: keep primary answer if critic provider is unavailable.
  }

  return { text: draft, criticUsed: false };
}

async function* streamProviderDeltas(
  provider: LlmProvider,
  request: LlmChatRequest,
  model: string,
): AsyncGenerator<string, void, void> {
  if (provider === 'openai') {
    const apiKey = apiKeyForProvider('openai');
    if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
    yield* streamOpenAiCompatibleDeltas(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${apiKey}` },
      request,
      model,
      buildOpenAiMessages(request),
    );
    return;
  }

  if (provider === 'perplexity') {
    const apiKey = apiKeyForProvider('perplexity');
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY is missing');
    yield* streamOpenAiCompatibleDeltas(
      'https://api.perplexity.ai/chat/completions',
      { Authorization: `Bearer ${apiKey}` },
      request,
      model,
      buildOpenAiMessages(request),
    );
    return;
  }

  yield* streamAnthropicDeltas(request, model);
}

export async function completeLlmChat(request: LlmChatRequest): Promise<LlmChatResult> {
  const { provider, fallbackUsed } = resolveProvider(request.provider);
  const model = request.model?.trim() || defaultModelForProvider(provider);
  let text = await completeWithProvider(provider, request, model);
  if (!text) throw new Error('LLM provider returned empty content');

  const criticOutcome = await applyCriticIfNeeded(request, provider, text);
  return {
    text: criticOutcome.text,
    provider,
    model,
    fallback_used: fallbackUsed,
    critic_used: criticOutcome.criticUsed,
    critic_provider: criticOutcome.criticProvider,
    critic_model: criticOutcome.criticModel,
  };
}

export async function* streamLlmChatDeltas(
  request: LlmChatRequest,
): AsyncGenerator<string, LlmChatResult, void> {
  const { provider, fallbackUsed } = resolveProvider(request.provider);
  const model = request.model?.trim() || defaultModelForProvider(provider);

  let draft = '';
  for await (const delta of streamProviderDeltas(provider, request, model)) {
    draft += delta;
    yield delta;
  }

  if (!draft.trim()) {
    draft = await completeWithProvider(provider, request, model);
  }

  if (!draft) throw new Error('LLM provider returned empty content');

  const criticOutcome = await applyCriticIfNeeded(request, provider, draft.trim());

  return {
    text: criticOutcome.text,
    provider,
    model,
    fallback_used: fallbackUsed,
    critic_used: criticOutcome.criticUsed,
    critic_provider: criticOutcome.criticProvider,
    critic_model: criticOutcome.criticModel,
  };
}
