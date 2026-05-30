import { API_BASE } from '../config';
import type { EigenChatResponse, SourceInventoryResponse } from '../types/chat';

export interface SendChatInput {
  accessToken: string;
  message: string;
  sessionId?: string;
  entityLabel?: string;
  entityScope?: string[];
  policyScope?: string[];
}

function parseChatResponse(data: Record<string, unknown>): EigenChatResponse {
  return {
    response: typeof data.response === 'string' ? data.response : '',
    citations: Array.isArray(data.citations)
      ? (data.citations as EigenChatResponse['citations'])
      : [],
    confidence: (data.confidence as EigenChatResponse['confidence']) ?? {
      overall: 'low',
      retrieval: 'low',
      upload_support: 'low',
      signals: { citation_count: 0, avg_relevance: 0, upload_ratio: 0 },
    },
    retrieval_run_id: typeof data.retrieval_run_id === 'string' ? data.retrieval_run_id : null,
    memory_updated: data.memory_updated === true,
    session_id: typeof data.session_id === 'string' ? data.session_id : '',
    effective_policy_scope: Array.isArray(data.effective_policy_scope)
      ? data.effective_policy_scope.map(String)
      : undefined,
    entity_scope_applied: Array.isArray(data.entity_scope_applied)
      ? data.entity_scope_applied.map(String)
      : undefined,
    entity_scope_mode:
      data.entity_scope_mode === 'boost' || data.entity_scope_mode === 'filter'
        ? data.entity_scope_mode
        : undefined,
    entity_resolution_sources: Array.isArray(data.entity_resolution_sources)
      ? data.entity_resolution_sources.map(String)
      : undefined,
    entity_context_count:
      typeof data.entity_context_count === 'number' ? data.entity_context_count : undefined,
  };
}

export async function sendChatMessage(input: SendChatInput): Promise<EigenChatResponse> {
  const body: Record<string, unknown> = {
    message: input.message,
    conversation_context: 'auto',
    response_format: 'structured',
    session_id: input.sessionId,
  };

  if (input.entityLabel?.trim()) {
    body.entity_label = input.entityLabel.trim();
  }
  if (input.entityScope?.length) {
    body.entity_scope = input.entityScope;
  }
  if (input.policyScope?.length) {
    body.policy_scope = input.policyScope;
  }

  const response = await fetch(`${API_BASE}/eigen-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return parseChatResponse(data);
}

export async function fetchSourceInventory(accessToken: string): Promise<SourceInventoryResponse> {
  const response = await fetch(`${API_BASE}/eigen-source-inventory`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return (await response.json()) as SourceInventoryResponse;
}
