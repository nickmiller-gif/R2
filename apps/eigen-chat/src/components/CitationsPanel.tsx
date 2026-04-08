import type { ChatResponse } from '../chatTypes';

export function CitationsPanel({
  citations,
  confidence,
  retrievalRunId,
}: {
  citations: ChatResponse['citations'];
  confidence?: ChatResponse['confidence'];
  retrievalRunId?: string | null;
}) {
  if (!citations.length && !confidence) return null;

  return (
    <details className="group mt-3 rounded-card border border-border bg-elevated/80 px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none font-medium text-fg outline-none transition marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>
            Sources
            {citations.length > 0 ? (
              <span className="ml-2 rounded-pill bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {citations.length}
              </span>
            ) : null}
          </span>
          <span className="text-muted transition group-open:rotate-180">▼</span>
        </span>
      </summary>
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {confidence ? (
          <p className="text-xs text-muted">
            Confidence: <strong className="text-fg">{confidence}</strong>
            {retrievalRunId ? (
              <>
                {' '}
                · Run <code className="rounded bg-surface px-1 text-[0.75rem]">{retrievalRunId}</code>
              </>
            ) : null}
          </p>
        ) : null}
        {citations.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {citations.map((c) => (
              <li
                key={c.chunk_id}
                className="max-w-full rounded-lg border border-border bg-surface px-2.5 py-1 text-xs shadow-soft"
                title={c.chunk_id}
              >
                <span className="font-mono text-[0.7rem] text-muted">{c.chunk_id.slice(0, 8)}…</span>
                <span className="mx-1 text-border">|</span>
                <span className="text-fg">{c.source}</span>
                <span className="ml-1 text-muted">{(c.relevance * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No citation chunks for this reply.</p>
        )}
      </div>
    </details>
  );
}
