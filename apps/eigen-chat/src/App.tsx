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

function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return `${fromEnv.replace(/\/+$/, '')}/functions/v1`;
  }
  return '/functions/v1';
}

export function App() {
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [entityScope, setEntityScope] = useState('');
  const [policyScope, setPolicyScope] = useState('');

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
