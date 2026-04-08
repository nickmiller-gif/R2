import type { ChatTier, SourceInventoryResponse } from '../chatTypes';

interface SourcesPanelProps {
  chatTier: ChatTier;
  onTierChange: (tier: ChatTier) => void;
  onLoad: () => void;
  isPending: boolean;
  error: string | null;
  data: SourceInventoryResponse | null;
}

export function SourcesPanel({ chatTier, onTierChange, onLoad, isPending, error, data }: SourcesPanelProps) {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-fg">Source inventory</h2>
      <p className="mt-1 text-sm text-muted">See which ingested sources each tier can retrieve.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          Tier
          <select
            value={chatTier}
            onChange={(e) => onTierChange(e.target.value as ChatTier)}
            className="ml-2 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg"
          >
            <option value="eigenx">EigenX</option>
            <option value="public">Public</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={onLoad}
        disabled={isPending}
        className="mt-4 rounded-xl bg-elevated px-5 py-2.5 text-sm font-medium text-fg ring-1 ring-border transition hover:bg-surface hover:ring-accent disabled:opacity-50"
      >
        {isPending ? 'Loading…' : `Load ${chatTier} sources`}
      </button>
      {error ? (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </pre>
      ) : null}
      {data ? (
        <div className="mt-6 overflow-x-auto">
          <p className="mb-3 text-sm text-muted">
            Mode <code className="text-fg">{data.mode}</code> ·{' '}
            <strong className="text-fg">{data.total_documents}</strong> docs ·{' '}
            <strong className="text-fg">{data.total_chunks}</strong> chunks
          </p>
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 pr-3 font-medium">Source system</th>
                <th className="pb-2 pr-3 text-right font-medium">Docs</th>
                <th className="pb-2 pr-3 text-right font-medium">Chunks</th>
                <th className="pb-2 font-medium">Sample refs</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((source) => (
                <tr key={source.source_system} className="border-b border-border/70">
                  <td className="py-2.5 pr-3 font-mono text-xs text-fg">{source.source_system}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{source.document_count}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{source.chunk_count}</td>
                  <td className="max-w-xs truncate py-2.5 text-muted">
                    {source.sample_source_refs.length > 0 ? source.sample_source_refs.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
