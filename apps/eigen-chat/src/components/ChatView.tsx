import { FormEvent, useEffect, useRef } from 'react';
import type { ChatMessage, ChatTier } from '../chatTypes';
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
  isLoading: boolean;
  chatError: string | null;
  streamError: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClearChat: () => void;
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
  isLoading,
  chatError,
  streamError,
  onSubmit,
  onClearChat,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const suggestions =
    chatTier === 'public'
      ? ['What does Rays Retreat offer?', 'How do I get in touch?', 'What is R2?']
      : ['Summarize the latest policy', 'What sources cover onboarding?', 'List key entities mentioned'];

  return (
    <div className="flex h-[min(72vh,640px)] flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-label uppercase text-accent">Chat</h2>
          <p className="mt-1 text-body text-muted">Grounded answers from your indexed corpus</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={chatTier}
            onChange={(e) => onTierChange(e.target.value as ChatTier)}
            className="h-9 rounded-lg border border-border bg-elevated px-3 text-body text-fg transition hover:border-border-hover"
          >
            <option value="eigenx">EigenX (signed in)</option>
            <option value="public">Public Eigen</option>
          </select>
          <button
            type="button"
            onClick={onClearChat}
            className="h-9 rounded-lg border border-border px-3 text-body text-muted transition hover:border-border-hover hover:text-fg"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
            <div>
              <p className="text-[24px] font-normal tracking-wide text-fg">Ask anything</p>
              <p className="mt-2 max-w-sm text-body text-muted">
                {chatTier === 'public'
                  ? 'Public mode uses the public corpus only. No account required.'
                  : 'Signed-in mode uses your EigenX retrieval scope (and session memory when enabled).'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onMessageChange(s)}
                  className="rounded-lg border border-border bg-elevated px-4 py-2 text-body text-fg transition hover:border-border-hover"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={[
                    'max-w-[min(100%,520px)] rounded-[10px] px-4 py-3 text-body transition',
                    m.role === 'user'
                      ? 'bg-accent text-[#07080A]'
                      : 'border border-border bg-elevated text-fg',
                  ].join(' ')}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  ) : (
                    <>
                      {m.content ? (
                        <MarkdownContent content={m.content} />
                      ) : m.streaming ? (
                        <span className="inline-flex items-center gap-2 text-muted">
                          <span className="animate-pulse text-label uppercase tracking-label">Processing</span>
                          <span className="inline-block h-3 w-[2px] animate-pulse bg-accent" />
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
        className="shrink-0 space-y-3 border-t border-border bg-canvas p-4"
      >
        {chatTier === 'eigenx' ? (
          <details className="rounded-lg border border-border bg-elevated px-3 py-2 text-body">
            <summary className="cursor-pointer text-label uppercase tracking-label text-accent">Advanced scope</summary>
            <div className="mt-3 grid gap-2">
              <input
                value={entityScope}
                onChange={(e) => onEntityScopeChange(e.target.value)}
                placeholder="Entity IDs (comma-separated UUIDs)"
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-fg placeholder:text-hint"
              />
              <input
                value={policyScope}
                onChange={(e) => onPolicyScopeChange(e.target.value)}
                placeholder="Policy tags (comma-separated)"
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-body text-fg placeholder:text-hint"
              />
            </div>
          </details>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 text-body text-muted">
          <input
            type="checkbox"
            checked={streamResponses}
            onChange={(e) => onStreamResponsesChange(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Stream response (SSE)
        </label>

        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Message Eigen..."
            rows={2}
            className="min-h-[48px] flex-1 resize-none rounded-[10px] border border-border bg-elevated px-4 py-3 text-body text-fg placeholder:text-hint transition focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className="shrink-0 self-end rounded-[10px] bg-accent px-6 py-3 text-body font-medium text-[#07080A] transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? '...' : 'SEND'}
          </button>
        </div>

        {(chatError || streamError) && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
            {chatError || streamError}
          </p>
        )}
      </form>
    </div>
  );
}
