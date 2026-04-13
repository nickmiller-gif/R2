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
    <details className="group mt-3 text-body">
      <summary className="cursor-pointer list-none text-muted outline-none transition marker:content-none hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="text-label uppercase tracking-label">Sources</span>
          {citations.length > 0 ? (
            <span className="rounded-md border border-border bg-elevated px-2 py-0.5 text-[9px] text-accent">
              {citations.length}
            </span>
          ) : null}
          <span className="text-hint transition group-open:rotate-180">&#9662;</span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 rounded-[10px] border border-border bg-elevated px-3 py-2">
        {confidence ? (
          <p className="text-body text-muted">
            Confidence: <span className="text-accent">{confidence}</span>
            {retrievalRunId ? (
              <>
                {' '}
                · Run <code className="rounded border border-border bg-canvas px-1 text-[10px] text-fg">{retrievalRunId}</code>
              </>
            ) : null}
          </p>
        ) : null}
        {citations.length > 0 ? (
          <ul className="space-y-2">
            {citations.map((c) => (
              <li
                key={c.chunk_id}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-body leading-snug"
                title={c.chunk_id}
              >
                {c.section ? (
                  <p className="text-fg">{c.section}</p>
                ) : null}
                <p className={c.section ? 'mt-0.5 text-muted' : 'text-fg'}>{c.source}</p>
                <p className="mt-0.5 text-[10px] text-hint">
                  Match strength <span className="text-accent">{(c.relevance * 100).toFixed(0)}%</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted">No indexed passages were attached to this reply.</p>
        )}
      </div>
    </details>
  );
}
