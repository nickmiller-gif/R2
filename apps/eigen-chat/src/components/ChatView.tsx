import { FormEvent, useEffect, useRef } from 'react';
import type { ChatMessage, ChatTier, LlmProvider } from '../chatTypes';
import { CitationsPanel } from './CitationsPanel';
import { MarkdownContent } from './MarkdownContent';

interface ChatViewProps {
  messages: ChatMessage[];
  chatTier: ChatTier;
  onTierChange: (tier: ChatTier) => void;
  message: string;
  onMessageChange: (value: string) => void;
  entityScope: string;
  onEntityScopeChange: (value: string) => void;
  policyScope: string;
  onPolicyScopeChange: (value: string) => void;
  streamResponses: boolean;
  onStreamResponsesChange: (value: boolean) => void;
  llmProvider: LlmProvider;
  onLlmProviderChange: (provider: LlmProvider) => void;
  llmModel: string;
  onLlmModelChange: (value: string) => void;
  isLoading: boolean;
  chatError: string | null;
  streamError: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClearChat: () => void;
}

function MessageAvatar({ role, tier }: { role: 'user' | 'assistant'; tier: ChatTier }) {
  const label = role === 'user' ? 'You' : tier === 'eigenx' ? 'X' : 'E';
  return (
    <div
      className={[
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[10px] font-medium uppercase tracking-[0.08em]',
        role === 'user'
          ? 'border-border bg-elevated text-fg'
          : tier === 'eigenx'
            ? 'border-transparent bg-gradient-to-br from-[#F0AB40] to-[#EF9F27] text-[#0A0A0D]'
            : 'border-transparent bg-[#0A0A0D] text-white',
      ].join(' ')}
      aria-hidden
    >
      {label}
    </div>
  );
}

export function ChatView({
  messages,
  chatTier,
  onTierChange,
  message,
  onMessageChange,
  entityScope,
  onEntityScopeChange,
  policyScope,
  onPolicyScopeChange,
  streamResponses,
  onStreamResponsesChange,
  llmProvider,
  onLlmProviderChange,
  llmModel,
  onLlmModelChange,
  isLoading,
  chatError,
  streamError,
  onSubmit,
  onClearChat,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scopedEntityCount = entityScope
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const suggestions =
    chatTier === 'public'
      ? ['Who is Ray?', 'What does Rays Retreat offer?', 'Tell me about the community']
      : [
          'Summarize this client relationship',
          'What do we know about this property?',
          'Who are the key people involved?',
        ];

  return (
    <div className="chat-shell flex h-[min(78vh,720px)] flex-col overflow-hidden rounded-[22px] border border-border/80 bg-surface/90 shadow-[0_24px_80px_oklch(0_0_0/0.22)] backdrop-blur-xl">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-b from-white/5 to-transparent px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-medium tracking-[-0.02em] text-fg">Eigen Chat</h2>
            {scopedEntityCount > 0 ? (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-accent">
                {scopedEntityCount} MEG entit{scopedEntityCount === 1 ? 'y' : 'ies'} scoped
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            Conversational answers grounded in clients, properties, people, and your corpus
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={chatTier}
            onChange={(e) => onTierChange(e.target.value as ChatTier)}
            className="h-10 rounded-xl border border-border bg-elevated/80 px-3 text-[13px] text-fg transition hover:border-border-hover"
          >
            <option value="eigenx">EigenX (signed in)</option>
            <option value="public">Public Eigen</option>
          </select>
          <button
            type="button"
            onClick={onClearChat}
            className="h-10 rounded-xl border border-border px-3 text-[13px] text-muted transition hover:border-border-hover hover:text-fg"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="chat-mesh min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
            <div>
              <p className="text-[28px] font-normal tracking-[-0.03em] text-fg">Ask anything</p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
                {chatTier === 'public'
                  ? 'Public mode uses approved public material. I answer like a chatbot — warm, direct, and grounded.'
                  : 'EigenX injects live MEG entity context when you scope clients, properties, or people, then answers conversationally from your corpus.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onMessageChange(s)}
                  className="rounded-full border border-border/80 bg-elevated/70 px-4 py-2.5 text-[13px] text-fg transition hover:border-accent/40 hover:bg-accent/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-5">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {m.role === 'user' || m.role === 'assistant' ? (
                  <MessageAvatar role={m.role} tier={chatTier} />
                ) : null}
                <div
                  className={[
                    'max-w-[min(100%,640px)] rounded-[18px] px-4 py-3.5 text-[15px] leading-relaxed shadow-[0_10px_30px_oklch(0_0_0/0.08)] backdrop-blur-md',
                    m.role === 'user'
                      ? 'rounded-br-md bg-elevated/90 text-fg'
                      : 'rounded-bl-md border border-border/70 bg-surface/95 text-fg',
                  ].join(' ')}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <>
                      {m.content ? (
                        <MarkdownContent content={m.content} />
                      ) : m.streaming ? (
                        <span className="inline-flex items-center gap-2 text-muted">
                          <span className="animate-pulse text-[11px] uppercase tracking-[0.16em]">
                            Thinking
                          </span>
                          <span className="inline-block h-4 w-[2px] animate-pulse bg-accent" />
                        </span>
                      ) : null}
                      {!m.streaming && m.citations && (
                        <CitationsPanel
                          citations={m.citations}
                          confidence={m.confidence}
                          retrieval_runId={m.retrieval_run_id}
                        />
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 space-y-3 border-t border-border/70 bg-gradient-to-t from-black/5 to-transparent p-5"
      >
        {chatTier === 'eigenx' ? (
          <details className="rounded-xl border border-border/80 bg-elevated/60 px-3 py-2 text-[13px]">
            <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-accent">
              Entity scope (MEG UUIDs)
            </summary>
            <div className="mt-3 grid gap-2">
              <input
                value={entityScope}
                onChange={(e) => onEntityScopeChange(e.target.value)}
                placeholder="Client / property / person MEG IDs (comma-separated)"
                className="w-full rounded-xl border border-border bg-surface/80 px-3 py-2.5 text-[13px] text-fg placeholder:text-hint"
              />
              <input
                value={policyScope}
                onChange={(e) => onPolicyScopeChange(e.target.value)}
                placeholder="Policy tags (comma-separated)"
                className="w-full rounded-xl border border-border bg-surface/80 px-3 py-2.5 text-[13px] text-fg placeholder:text-hint"
              />
            </div>
          </details>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={streamResponses}
            onChange={(e) => onStreamResponsesChange(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Stream response (SSE)
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            <span className="text-[11px] uppercase tracking-[0.14em] text-hint">Provider</span>
            <select
              value={llmProvider}
              onChange={(e) => onLlmProviderChange(e.target.value as LlmProvider)}
              className="rounded-xl border border-border bg-elevated/80 px-3 py-2.5 text-[13px] text-fg"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="perplexity">Perplexity</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            <span className="text-[11px] uppercase tracking-[0.14em] text-hint">
              Model override
            </span>
            <input
              value={llmModel}
              onChange={(e) => onLlmModelChange(e.target.value)}
              placeholder="e.g. gpt-4o-mini"
              className="rounded-xl border border-border bg-elevated/80 px-3 py-2.5 text-[13px] text-fg placeholder:text-hint"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Ask about a client, property, or person…"
            rows={2}
            className="min-h-[52px] flex-1 resize-none rounded-2xl border border-border/80 bg-elevated/80 px-4 py-3.5 text-[15px] text-fg placeholder:text-hint shadow-inner transition focus:border-accent/50 focus:shadow-[0_0_0_3px_oklch(0.82_0.14_70/0.18)]"
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className="shrink-0 self-end rounded-2xl bg-gradient-to-br from-[#F0AB40] to-[#EF9F27] px-6 py-3.5 text-[14px] font-medium text-[#0A0A0D] shadow-[0_12px_28px_oklch(0.55_0.16_40/0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {isLoading ? '…' : 'Send'}
          </button>
        </div>

        {(chatError || streamError) && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {chatError || streamError}
          </p>
        )}
      </form>
    </div>
  );
}
