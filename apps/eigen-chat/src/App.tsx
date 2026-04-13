import { FormEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type {
  ChatMessage,
  ChatMessageAssistant,
  ChatResponse,
  ChatTier,
  IngestCorpusTier,
  IngestResponse,
  SourceInventoryResponse,
} from './chatTypes';
import { consumeEigenChatSse } from './chatSse';
import { ChatView } from './components/ChatView';
import { EigenXLogo } from './components/EigenXLogo';
import { IngestPanel } from './components/IngestPanel';
import { SourcesPanel } from './components/SourcesPanel';
import { WorkspaceTabs, type TabId } from './components/WorkspaceTabs';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return `${fromEnv.replace(/\/+$/, '')}/functions/v1`;
  }
  return '/functions/v1';
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [chatTier, setChatTier] = useState<ChatTier>('eigenx');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [entityScope, setEntityScope] = useState('');
  const [policyScope, setPolicyScope] = useState('');
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestSourceRef, setIngestSourceRef] = useState('');
  const [ingestTier, setIngestTier] = useState<IngestCorpusTier>('eigenx');
  const [ingestLocalError, setIngestLocalError] = useState<string | null>(null);
  const [streamResponses, setStreamResponses] = useState(false);
  const [isStreamingChat, setIsStreamingChat] = useState(false);
  const [streamChatError, setStreamChatError] = useState<string | null>(null);
  const [sourceInventory, setSourceInventory] = useState<SourceInventoryResponse | null>(null);
  const [sourceInventoryError, setSourceInventoryError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const chatMutation = useMutation({
    mutationFn: async (input: {
      message: string;
      sessionId?: string;
      entityScope: string[];
      policyScope: string[];
      tier: ChatTier;
    }) => {
      const endpoint = input.tier === 'public' ? 'eigen-chat-public' : 'eigen-chat';
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (input.tier === 'eigenx') {
        headers.Authorization = `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`;
      }
      const response = await fetch(`${apiBaseUrl}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: input.message,
          session_id: input.tier === 'eigenx' ? input.sessionId : undefined,
          conversation_context: 'auto',
          response_format: 'structured',
          entity_scope: input.tier === 'eigenx' ? input.entityScope : undefined,
          policy_scope: input.tier === 'eigenx' ? input.policyScope : undefined,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as ChatResponse;
    },
    onSuccess: (result, variables) => {
      if (variables.tier === 'eigenx') setSessionId(result.session_id);
      setMessage('');
      setStreamChatError(null);
      const assistant: ChatMessageAssistant = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.response,
        citations: result.citations,
        confidence: result.confidence,
        retrieval_run_id: result.retrieval_run_id,
      };
      setMessages((prev) => [...prev, assistant]);
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async (input: { title: string; sourceRef: string; file: File; tier: IngestCorpusTier }) => {
      const form = new FormData();
      form.set('source_system', 'manual-upload');
      form.set('source_ref', input.sourceRef);
      form.set('title', input.title);
      form.set('file', input.file, input.file.name);
      form.set('content_type', input.file.type || 'application/octet-stream');
      form.set('policy_tags', JSON.stringify(input.tier === 'public' ? ['eigen_public'] : ['eigenx']));
      const response = await fetch(`${apiBaseUrl}/eigen-ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`,
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as IngestResponse;
    },
    onMutate: () => setIngestLocalError(null),
  });

  const sourceInventoryMutation = useMutation({
    mutationFn: async (tier: ChatTier) => {
      const endpoint = tier === 'public' ? 'eigen-public-sources' : 'eigen-source-inventory';
      const headers: HeadersInit = {};
      if (tier === 'eigenx') {
        headers.Authorization = `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`;
      }
      const response = await fetch(`${apiBaseUrl}/${endpoint}`, { method: 'GET', headers });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as SourceInventoryResponse;
    },
    onMutate: () => setSourceInventoryError(null),
    onSuccess: (result) => {
      setSourceInventory(result);
      setSourceInventoryError(null);
    },
    onError: (err) => {
      setSourceInventoryError(err instanceof Error ? err.message : 'Failed to load sources');
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
    if (file.size === 0) {
      setIngestLocalError('File is empty.');
      return;
    }
    const defaultTitle = ingestTitle.trim() || file.name.replace(/\.[^/.]+$/, '') || 'Uploaded document';
    const sourceRef =
      ingestSourceRef.trim() || `file:${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}:${Date.now()}`;
    ingestMutation.mutate({ title: defaultTitle, sourceRef, file, tier: ingestTier });
  };

  const handleTierChange = (tier: ChatTier) => {
    setChatTier(tier);
    setSessionId(undefined);
    setMessages([]);
    setStreamChatError(null);
    chatMutation.reset();
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setStreamChatError(null);
    chatMutation.reset();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length === 0) return;

    const entityList = entityScope
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const policyList = policyScope
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    if (streamResponses) {
      const assistantId = crypto.randomUUID();
      setStreamChatError(null);
      setIsStreamingChat(true);
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          streaming: true,
          citations: [],
        },
      ]);

      void (async () => {
        try {
          const endpoint = chatTier === 'public' ? 'eigen-chat-public' : 'eigen-chat';
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (chatTier === 'eigenx') {
            headers.Authorization = `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`;
          }
          const response = await fetch(`${apiBaseUrl}/${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              message: trimmed,
              session_id: chatTier === 'eigenx' ? sessionId : undefined,
              conversation_context: 'auto',
              response_format: 'structured',
              entity_scope: chatTier === 'eigenx' ? entityList : undefined,
              policy_scope: chatTier === 'eigenx' ? policyList : undefined,
              stream: true,
            }),
          });

          const result = await consumeEigenChatSse(response, (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && m.role === 'assistant'
                  ? { ...m, content: m.content + delta }
                  : m,
              ),
            );
          });

          if (chatTier === 'eigenx') setSessionId(result.session_id);
          setMessage('');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.role === 'assistant'
                ? {
                    ...m,
                    content: result.response,
                    streaming: false,
                    citations: result.citations,
                    confidence: result.confidence,
                    retrieval_run_id: result.retrieval_run_id,
                  }
                : m,
            ),
          );
        } catch (err) {
          setStreamChatError(err instanceof Error ? err.message : 'Request failed');
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        } finally {
          setIsStreamingChat(false);
        }
      })();
      return;
    }

    setMessages((prev) => [...prev, userMsg]);

    chatMutation.mutate({
      message: trimmed,
      sessionId,
      entityScope: entityList,
      policyScope: policyList,
      tier: chatTier,
    });
  };

  const chatMutationError =
    chatMutation.isError && chatMutation.error instanceof Error ? chatMutation.error.message : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <EigenXLogo size={24} />
          <h1 className="text-[13px] font-normal uppercase tracking-wordmark text-fg">EigenX</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="relative flex h-[7px] w-[7px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-accent" />
            </span>
            <span className="text-label uppercase text-hint">Online</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <WorkspaceTabs active={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            chatTier={chatTier}
            onTierChange={handleTierChange}
            message={message}
            onMessageChange={setMessage}
            entityScope={entityScope}
            onEntityScopeChange={setEntityScope}
            policyScope={policyScope}
            onPolicyScopeChange={setPolicyScope}
            streamResponses={streamResponses}
            onStreamResponsesChange={setStreamResponses}
            isLoading={chatMutation.isPending || isStreamingChat}
            chatError={chatMutationError}
            streamError={streamChatError}
            onSubmit={onSubmit}
            onClearChat={handleClearChat}
          />
        )}

        {activeTab === 'ingest' && (
          <IngestPanel
            ingestTitle={ingestTitle}
            onIngestTitleChange={setIngestTitle}
            ingestSourceRef={ingestSourceRef}
            onIngestSourceRefChange={setIngestSourceRef}
            ingestTier={ingestTier}
            onIngestTierChange={setIngestTier}
            maxMb={MAX_UPLOAD_BYTES / (1024 * 1024)}
            onFileChange={(files) => {
              void onUploadTextFile(files);
            }}
            isPending={ingestMutation.isPending}
            localError={ingestLocalError}
            mutationError={
              ingestMutation.isError && ingestMutation.error instanceof Error
                ? ingestMutation.error.message
                : null
            }
            lastResult={ingestMutation.data ?? null}
          />
        )}

        {activeTab === 'sources' && (
          <SourcesPanel
            chatTier={chatTier}
            onTierChange={handleTierChange}
            onLoad={() => sourceInventoryMutation.mutate(chatTier)}
            isPending={sourceInventoryMutation.isPending}
            error={sourceInventoryError}
            data={sourceInventory}
          />
        )}
      </main>
    </div>
  );
}
