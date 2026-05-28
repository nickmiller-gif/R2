import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ChatTier, LlmProvider } from '../chatTypes';
import { CitationsPanel } from './CitationsPanel';
import { CosmicAmbient } from './CosmicAmbient';
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
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border text-[10px] font-medium uppercase tracking-[0.08em] shadow-sm',
        role === 'user'
          ? 'border-border bg-elevated text-fg'
          : tier === 'eigenx'
            ? 'border-transparent bg-gradient-to-br from-[#F0AB40] to-[#EF9F27] text-[#0A0A0D] shadow-[0_8px_20px_oklch(0.55_0.16_40/0.35)]'
            : 'border-transparent bg-[#0A0A0D] text-white',
      ].join(' ')}
      aria-hidden
    >
      {label}
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="typing-dots inline-flex items-center gap-1.5" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

function WelcomeHero({ tier }: { tier: ChatTier }) {
  return (
    <div className="welcome-hero mx-auto max-w-lg text-center">
      <div className="hero-glow pointer-events-none" aria-hidden />
      <div className="hero-orbs pointer-events-none" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>
      <div className="relative z-[1]">
        <h2 className="hero-title">{tier === 'eigenx' ? 'EigenX Intelligence' : 'Public Eigen'}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {tier === 'eigenx'
            ? 'Scope a client, property, or person — I inject live MEG context and answer like a knowledgeable assistant.'
            : 'Warm, conversational answers from public material about people, programs, and the community.'}
        </p>
        <div className="hero-capabilities mt-4 flex flex-wrap justify-center gap-2">
          {['Clients', 'Properties', 'People'].map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/70 bg-elevated/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-muted"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
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
  const [composerPulse, setComposerPulse] = useState(false);
  const scopedEntityCount = entityScope
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length;

  const quickPrompts = useMemo(() => {
    if (chatTier === 'public') {
      return ['What is Rays Retreat?', 'Who is Ray?', 'How do I get involved?'];
    }
    return scopedEntityCount > 0
      ? [
          'Summarize this client relationship',
          'Who are the key people involved?',
          'What should I know about this property?',
        ]
      : [
          'Who are our active clients?',
          'Tell me about a property in the portfolio',
          'Who should I talk to about this deal?',
        ];
  }, [chatTier, scopedEntityCount]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    setComposerPulse(true);
    const timer = window.setTimeout(() => setComposerPulse(false), 560);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setComposerPulse(true);
    onSubmit(event);
  };

  return (
    <div className="chat-shell-v2 relative flex h-[min(80vh,760px)] flex-col overflow-hidden rounded-[24px]">
      <CosmicAmbient />
      <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface/70 px-5 py-4 backdrop-blur-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-medium tracking-[-0.02em] text-fg">Eigen Chat</h2>
            {scopedEntityCount > 0 ? (
              <span className="entity-pill rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-accent">
                {scopedEntityCount} MEG scoped
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-muted">Clients · Properties · People</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={chatTier}
            onChange={(e) => onTierChange(e.target.value as ChatTier)}
            className="h-10 rounded-xl border border-border bg-elevated/80 px-3 text-[13px] text-fg"
          >
            <option value="eigenx">EigenX (signed in)</option>
            <option value="public">Public Eigen</option>
          </select>
          <button
            type="button"
            onClick={onClearChat}
            className="h-10 rounded-xl border border-border px-3 text-[13px] text-muted hover:text-fg"
          >
            Clear
          </button>
        </div>
      </div>

      {scopedEntityCount > 0 ? (
        <div className="entity-ribbon relative z-[1] mx-5 mt-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-[13px] text-fg">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
          Live MEG context will be injected for scoped entities on each turn.
        </div>
      ) : null}

      <div className="chat-mesh relative z-[1] min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <WelcomeHero tier={chatTier} />
            <div className="flex flex-wrap justify-center gap-2">
              {quickPrompts.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onMessageChange(s)}
                  className="quick-prompt-chip rounded-full border border-border/80 bg-elevated/70 px-4 py-2.5 text-[13px] text-fg transition hover:border-accent/40 hover:bg-accent/10"
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
                className={`turn-enter flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {m.role === 'user' || m.role === 'assistant' ? (
                  <MessageAvatar role={m.role} tier={chatTier} />
                ) : null}
                <div
                  className={[
                    'message-bubble relative max-w-[min(100%,680px)] overflow-hidden rounded-[20px] px-4 py-3.5 text-[15px] leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-elevated/95 text-fg shadow-[0_12px_32px_oklch(0_0_0/0.10)]'
                      : 'rounded-bl-md border border-border/60 bg-surface/95 text-fg shadow-[0_14px_36px_oklch(0_0_0/0.10)]',
                    m.streaming ? 'streaming-shimmer' : '',
                  ].join(' ')}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <>
                      {m.content ? (
                        <MarkdownContent content={m.content} />
                      ) : m.streaming ? (
                        <TypingIndicator />
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

      <div className="relative z-[1] shrink-0 border-t border-border/60 bg-surface/60 px-5 py-4 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickPrompts.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onMessageChange(s)}
              className="quick-prompt-chip rounded-full border border-border/70 bg-elevated/60 px-3 py-1.5 text-[12px] text-muted transition hover:border-accent/40 hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {chatTier === 'eigenx' ? (
            <details className="rounded-xl border border-border/80 bg-elevated/50 px-3 py-2 text-[13px]">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-accent">
                Entity scope (MEG UUIDs)
              </summary>
              <div className="mt-3 grid gap-2">
                <input
                  value={entityScope}
                  onChange={(e) => onEntityScopeChange(e.target.value)}
                  placeholder="Client / property / person MEG IDs"
                  className="w-full rounded-xl border border-border bg-surface/80 px-3 py-2.5 text-[13px]"
                />
                <input
                  value={policyScope}
                  onChange={(e) => onPolicyScopeChange(e.target.value)}
                  placeholder="Policy tags (comma-separated)"
                  className="w-full rounded-xl border border-border bg-surface/80 px-3 py-2.5 text-[13px]"
                />
              </div>
            </details>
          ) : null}

          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={streamResponses}
              onChange={(e) => onStreamResponsesChange(e.target.checked)}
              className="accent-accent"
            />
            Stream response (SSE)
          </label>

          <div
            className={[
              'composer-v2 flex items-end gap-3 rounded-[20px] border border-border/80 bg-elevated/80 p-3 shadow-[inset_0_1px_0_oklch(1_0_0/0.05),0_16px_40px_oklch(0_0_0/0.12)] backdrop-blur-md',
              composerPulse ? 'send-pulse' : '',
            ].join(' ')}
          >
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Ask about a client, property, or person…"
              rows={2}
              className="min-h-[52px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[15px] text-fg placeholder:text-hint focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#F0AB40] to-[#EF9F27] text-[#0A0A0D] shadow-[0_10px_28px_oklch(0.55_0.16_40/0.35)] transition hover:-translate-y-0.5 disabled:opacity-40"
              aria-label="Send"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {(chatError || streamError) && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {chatError || streamError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
