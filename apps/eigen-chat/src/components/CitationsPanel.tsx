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
    <details className="group mt-2 text-sm">
      <summary className="cursor-pointer list-none text-muted outline-none transition marker:content-none hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span>Where this came from</span>
          {citations.length > 0 ? (
            <span className="rounded-pill bg-border/40 px-2 py-0.5 text-[0.7rem] font-medium text-fg">
              {citations.length}
            </span>
          ) : null}
          <span className="text-muted transition group-open:rotate-180">▼</span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 rounded-card border border-border bg-elevated/80 px-3 py-2">
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
          <ul className="space-y-2">
            {citations.map((c) => (
              <li
                key={c.chunk_id}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs leading-snug shadow-soft"
                title={c.chunk_id}
              >
                {c.section ? (
                  <p className="font-medium text-fg">{c.section}</p>
                ) : null}
                <p className={c.section ? 'mt-0.5 text-muted' : 'text-fg'}>{c.source}</p>
                <p className="mt-0.5 text-[0.7rem] text-muted">Match strength {(c.relevance * 100).toFixed(0)}%</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No indexed passages were attached to this reply.</p>
        )}
      </div>
    </details>
  );
}
