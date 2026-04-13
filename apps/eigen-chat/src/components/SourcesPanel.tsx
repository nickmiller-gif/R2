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
    <section className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-label uppercase tracking-label text-accent">Source inventory</h2>
      <p className="mt-2 text-body text-muted">See which ingested sources each tier can retrieve.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-body text-muted">
          <span className="text-label uppercase tracking-label text-hint">Tier</span>
          <select
            value={chatTier}
            onChange={(e) => onTierChange(e.target.value as ChatTier)}
            className="rounded-lg border border-border bg-elevated px-3 py-2 text-body text-fg transition hover:border-border-hover"
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
        className="mt-4 rounded-[10px] border border-accent bg-transparent px-5 py-2.5 text-label uppercase tracking-label text-accent transition hover:bg-accent/10 disabled:opacity-40"
      >
        {isPending ? 'Loading...' : `Load ${chatTier} sources`}
      </button>
      {error ? (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/10 p-3 text-body text-danger">
          {error}
        </pre>
      ) : null}
      {data ? (
        <div className="mt-6 overflow-x-auto">
          <p className="mb-3 text-body text-muted">
            Mode <code className="text-fg">{data.mode}</code> ·{' '}
            <span className="text-fg">{data.total_documents}</span> docs ·{' '}
            <span className="text-fg">{data.total_chunks}</span> chunks
          </p>
          <table className="w-full min-w-[520px] border-collapse text-body">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-3 text-label uppercase tracking-label font-normal text-hint">Source system</th>
                <th className="pb-2 pr-3 text-right text-label uppercase tracking-label font-normal text-hint">Docs</th>
                <th className="pb-2 pr-3 text-right text-label uppercase tracking-label font-normal text-hint">Chunks</th>
                <th className="pb-2 text-label uppercase tracking-label font-normal text-hint">Sample refs</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((source) => (
                <tr key={source.source_system} className="border-b border-border">
                  <td className="py-2.5 pr-3 text-fg">{source.source_system}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-fg">{source.document_count}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-fg">{source.chunk_count}</td>
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
