import { FormEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface ChatResponse {
  response: string;
  citations: Array<{ chunk_id: string; source: string; relevance: number }>;
  confidence: 'low' | 'medium' | 'high';
  retrieval_run_id: string | null;
  memory_updated: boolean;
  session_id: string;
}

interface IngestResponse {
  document_id: string;
  ingestion_run_id: string;
  chunks_created: number;
  content_unchanged?: boolean;
  idempotent_replay?: boolean;
}

function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return `${fromEnv.replace(/\/+$/, '')}/functions/v1`;
  }
  return '/functions/v1';
}

const TEXT_UPLOAD_ACCEPT = '.txt,.md,.csv,text/plain';
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function App() {
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [entityScope, setEntityScope] = useState('');
  const [policyScope, setPolicyScope] = useState('');
  const [ingestSourceRef, setIngestSourceRef] = useState('');
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestLocalError, setIngestLocalError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const chatMutation = useMutation({
    mutationFn: async (input: {
      message: string;
      sessionId?: string;
      entityScope: string[];
      policyScope: string[];
    }) => {
      const response = await fetch(`${apiBaseUrl}/eigen-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`,
        },
        body: JSON.stringify({
          message: input.message,
          session_id: input.sessionId,
          conversation_context: 'auto',
          response_format: 'structured',
          entity_scope: input.entityScope,
          policy_scope: input.policyScope,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      return (await response.json()) as ChatResponse;
    },
    onSuccess: (result) => {
      setSessionId(result.session_id);
      setMessage('');
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async (input: { title: string; body: string; sourceRef: string }) => {
      const response = await fetch(`${apiBaseUrl}/eigen-ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`,
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          source_system: 'manual-upload',
          source_ref: input.sourceRef,
          document: {
            title: input.title,
            body: input.body,
            content_type: 'text/plain',
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      return (await response.json()) as IngestResponse;
    },
    onMutate: () => {
      setIngestLocalError(null);
    },
    onSuccess: () => {
      setIngestLocalError(null);
    },
  });

  const onUploadTextFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setIngestLocalError(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setIngestLocalError(`File is too large (max ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)} MB).`);
      return;
    }

    const text = await file.text();
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setIngestLocalError('File is empty.');
      return;
    }

    const defaultTitle = ingestTitle.trim() || file.name.replace(/\.[^/.]+$/, '') || 'Uploaded document';
    const sourceRef =
      ingestSourceRef.trim() ||
      `file:${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}:${Date.now()}`;

    ingestMutation.mutate({
      title: defaultTitle,
      body: trimmed,
      sourceRef,
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length === 0) return;
    chatMutation.mutate({
      message: trimmed,
      sessionId,
      entityScope: entityScope
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      policyScope: policyScope
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });
  };

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>Standalone Eigen Chat</h1>
      <p style={{ color: '#475569' }}>
        Grounded retrieval chat UI for <code>eigen-chat</code> and <code>eigen-retrieve</code>.
      </p>

      <section
        style={{
          marginTop: 20,
          padding: 16,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#fafafa',
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Ingest text file</h2>
        <p style={{ marginTop: 0, color: '#64748b', fontSize: 14 }}>
          Upload a .txt, .md, or .csv file (max {(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)} MB) into the knowledge
          index via <code>eigen-ingest</code>. Re-uploading the same <strong>source ref</strong> and unchanged content
          skips re-embedding.
        </p>
        <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
          <input
            value={ingestTitle}
            onChange={(event) => setIngestTitle(event.target.value)}
            placeholder="Document title (optional; defaults from filename)"
            style={{ width: '100%', padding: 10 }}
          />
          <input
            value={ingestSourceRef}
            onChange={(event) => setIngestSourceRef(event.target.value)}
            placeholder="Stable source ref (optional; auto if empty)"
            style={{ width: '100%', padding: 10 }}
          />
          <label style={{ fontSize: 14, color: '#334155' }}>
            <span style={{ display: 'block', marginBottom: 6 }}>Choose file</span>
            <input
              type="file"
              accept={TEXT_UPLOAD_ACCEPT}
              onChange={(event) => {
                void onUploadTextFile(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {ingestMutation.isPending ? <p style={{ marginTop: 10 }}>Ingesting…</p> : null}
        {ingestLocalError ? (
          <pre style={{ marginTop: 10, color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {ingestLocalError}
          </pre>
        ) : null}
        {ingestMutation.isError ? (
          <pre style={{ marginTop: 10, color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {(ingestMutation.error as Error).message}
          </pre>
        ) : null}
        {ingestMutation.data ? (
          <p style={{ marginTop: 10, color: '#15803d', fontSize: 14 }}>
            Ingested <code>{ingestMutation.data.document_id}</code> — {ingestMutation.data.chunks_created} chunk(s)
            {ingestMutation.data.content_unchanged ? ' (content unchanged, skipped embed)' : ''}.
          </p>
        ) : null}
      </section>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask Eigen a question..."
          rows={5}
          style={{ width: '100%', padding: 12 }}
        />
        <input
          value={entityScope}
          onChange={(event) => setEntityScope(event.target.value)}
          placeholder="Entity scope (comma-separated UUIDs)"
          style={{ width: '100%', padding: 10 }}
        />
        <input
          value={policyScope}
          onChange={(event) => setPolicyScope(event.target.value)}
          placeholder="Policy scope (comma-separated tags)"
          style={{ width: '100%', padding: 10 }}
        />
        <button type="submit" disabled={chatMutation.isPending} style={{ width: 220, padding: 10 }}>
          {chatMutation.isPending ? 'Asking...' : 'Ask Eigen'}
        </button>
      </form>

      {chatMutation.isError ? (
        <pre style={{ marginTop: 18, color: '#b91c1c', whiteSpace: 'pre-wrap' }}>
          {(chatMutation.error as Error).message}
        </pre>
      ) : null}

      {chatMutation.data ? (
        <section style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <h2 style={{ marginBottom: 0 }}>Response</h2>
          <pre style={{ margin: 0, background: '#f8fafc', padding: 12, whiteSpace: 'pre-wrap' }}>
            {chatMutation.data.response}
          </pre>
          <div style={{ color: '#334155' }}>
            Confidence: <strong>{chatMutation.data.confidence}</strong> | Retrieval run:{' '}
            <code>{chatMutation.data.retrieval_run_id ?? 'none'}</code>
          </div>
          <div>
            <h3>Citations</h3>
            <ul>
              {chatMutation.data.citations.map((citation) => (
                <li key={citation.chunk_id}>
                  <code>{citation.chunk_id}</code> — {citation.source} ({citation.relevance})
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
