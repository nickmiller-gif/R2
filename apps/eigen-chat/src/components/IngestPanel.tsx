import type { IngestCorpusTier } from '../chatTypes';

const INGEST_UPLOAD_ACCEPT =
  '.txt,.md,.csv,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface IngestPanelProps {
  ingestTitle: string;
  onIngestTitleChange: (v: string) => void;
  ingestSourceRef: string;
  onIngestSourceRefChange: (v: string) => void;
  ingestTier: IngestCorpusTier;
  onIngestTierChange: (v: IngestCorpusTier) => void;
  maxMb: number;
  onFileChange: (files: FileList | null) => void;
  isPending: boolean;
  localError: string | null;
  mutationError: string | null;
  lastResult: { document_id: string; chunks_created: number; content_unchanged?: boolean } | null;
}

export function IngestPanel({
  ingestTitle,
  onIngestTitleChange,
  ingestSourceRef,
  onIngestSourceRefChange,
  ingestTier,
  onIngestTierChange,
  maxMb,
  onFileChange,
  isPending,
  localError,
  mutationError,
  lastResult,
}: IngestPanelProps) {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-fg">Ingest document</h2>
      <p className="mt-1 text-sm text-muted">
        Upload .txt, .md, .csv, .pdf, or .docx (max {maxMb} MB). PDF/DOCX are extracted server-side before
        chunking. Choose <code className="text-fg">eigen_public</code> or internal{' '}
        <code className="text-fg">eigenx</code>.
      </p>
      <div className="mt-6 grid max-w-lg gap-3">
        <input
          value={ingestTitle}
          onChange={(e) => onIngestTitleChange(e.target.value)}
          placeholder="Document title (optional)"
          className="rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm"
        />
        <input
          value={ingestSourceRef}
          onChange={(e) => onIngestSourceRefChange(e.target.value)}
          placeholder="Stable source ref (optional)"
          className="rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm"
        />
        <select
          value={ingestTier}
          onChange={(e) => onIngestTierChange(e.target.value as IngestCorpusTier)}
          className="rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm"
        >
          <option value="eigenx">EigenX (internal)</option>
          <option value="public">Public Eigen</option>
        </select>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-fg">File</span>
          <input
            type="file"
            accept={INGEST_UPLOAD_ACCEPT}
            onChange={(e) => {
              onFileChange(e.target.files);
              e.target.value = '';
            }}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover"
          />
        </label>
      </div>
      {isPending ? <p className="mt-4 text-sm text-muted">Ingesting…</p> : null}
      {localError ? (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {localError}
        </pre>
      ) : null}
      {mutationError ? (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {mutationError}
        </pre>
      ) : null}
      {lastResult ? (
        <p className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          Ingested <code className="text-fg">{lastResult.document_id}</code> — {lastResult.chunks_created} chunk(s)
          {lastResult.content_unchanged ? ' (unchanged, skipped embed)' : ''}.
        </p>
      ) : null}
    </section>
  );
}
