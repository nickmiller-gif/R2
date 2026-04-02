import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getValidationStatus } from '@/lib/api/getValidationStatus';
import { postMessage } from '@/lib/api/postMessage';
import type { ValidationBatch } from '@/types/validation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type LocalMessage = { id: string; text: string; from: 'founder' | 'researcher'; timestamp: string };

function formatCountdown(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Time elapsed';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export default function StatusPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<ValidationBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    try {
      const data = await getValidationStatus(batchId!);
      setBatch(data);
      setCountdown(formatCountdown(data.slaDeadline));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load status');
    }
  }

  useEffect(() => {
    void fetchStatus();
    intervalRef.current = setInterval(() => { void fetchStatus(); }, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (batch) setCountdown(formatCountdown(batch.slaDeadline));
    }, 60_000);
    return () => clearInterval(timer);
  }, [batch]);

  async function handleSendMessage() {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const { messageId } = await postMessage({ batchId: batchId!, text: msgText.trim() });
      setMessages((prev) => [
        ...prev,
        { id: messageId, text: msgText.trim(), from: 'founder', timestamp: new Date().toISOString() },
      ]);
      setMsgText('');
    } catch {
      // message send failed silently
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-sans text-red-600">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void fetchStatus()}>Retry</Button>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-label="Loading status" />
      </div>
    );
  }

  const complete = batch.interviewsComplete >= batch.interviewsTotal;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 font-serif text-4xl font-bold text-ink">Your validation is underway</h1>
      <p className="mb-10 font-sans text-ink-muted">
        {batch.researcherName ? `Researcher: ${batch.researcherName}` : 'Researcher being assigned…'}
      </p>

      {/* SLA countdown */}
      <Card className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-sans text-sm text-ink-muted">SLA deadline</p>
          <p className="font-mono text-2xl font-bold text-ink">{countdown}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-sm text-ink-muted">Due by</p>
          <p className="font-mono text-sm text-ink">
            {new Date(batch.slaDeadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </Card>

      {/* Interview tracker */}
      <Card className="mb-6">
        <h2 className="mb-4 font-serif text-lg font-bold text-ink">
          Interviews: {batch.interviewsComplete} / {batch.interviewsTotal}
        </h2>
        <div className="flex gap-3" role="list" aria-label="Interview progress">
          {Array.from({ length: batch.interviewsTotal }).map((_, i) => (
            <div
              key={i}
              role="listitem"
              aria-label={i < batch.interviewsComplete ? `Interview ${i + 1} complete` : `Interview ${i + 1} pending`}
              className={[
                'h-10 w-10 rounded-full border-2 flex items-center justify-center font-mono text-sm font-bold transition-colors',
                i < batch.interviewsComplete
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-ink/20 bg-surface text-ink-faint',
              ].join(' ')}
            >
              {i < batch.interviewsComplete ? '✓' : i + 1}
            </div>
          ))}
        </div>
        {complete && (
          <div className="mt-6 rounded-lg bg-brand-50 p-4 text-center">
            <p className="font-serif text-lg font-bold text-brand-700">All interviews complete!</p>
            <p className="mt-1 font-sans text-sm text-brand-600">Your report is ready.</p>
            <Link
              to={`/report/${batchId}`}
              className="mt-4 inline-block rounded bg-brand-600 px-6 py-2.5 font-sans font-medium text-white hover:bg-brand-700 transition-colors"
            >
              View report →
            </Link>
          </div>
        )}
      </Card>

      {/* Async message box */}
      <Card>
        <h2 className="mb-4 font-serif text-lg font-bold text-ink">Ask your researcher</h2>
        <div
          className="mb-4 min-h-[80px] space-y-2 rounded border border-ink/10 bg-surface p-3"
          aria-live="polite"
          aria-label="Message thread"
        >
          {messages.length === 0 ? (
            <p className="font-sans text-sm text-ink-faint">No messages yet. Ask anything about the interviews.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'founder' ? 'justify-end' : 'justify-start'}`}>
                <span
                  className={[
                    'max-w-[75%] rounded-lg px-3 py-2 font-sans text-sm',
                    m.from === 'founder'
                      ? 'bg-brand-100 text-brand-900'
                      : 'bg-surface-sunken text-ink',
                  ].join(' ')}
                >
                  {m.text}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Type a message…"
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSendMessage(); }}
            aria-label="Message to researcher"
          />
          <Button
            variant="secondary"
            loading={sending}
            onClick={() => void handleSendMessage()}
            aria-label="Send message"
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
