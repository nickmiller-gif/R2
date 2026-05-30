export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type EntityScopeMode = 'filter' | 'boost';

export interface ChatCitation {
  chunk_id: string;
  source: string;
  section?: string;
  relevance: number;
  authority_tier: 'user_upload' | 'oracle' | 'charter' | 'web' | 'corpus';
}

export interface ChatConfidence {
  overall: ConfidenceLabel;
  retrieval: ConfidenceLabel;
  upload_support: ConfidenceLabel;
  signals: {
    citation_count: number;
    avg_relevance: number;
    upload_ratio: number;
  };
}

export interface EigenChatResponse {
  response: string;
  citations: ChatCitation[];
  confidence: ChatConfidence;
  retrieval_run_id: string | null;
  memory_updated: boolean;
  session_id: string;
  effective_policy_scope?: string[];
  entity_scope_applied?: string[];
  entity_scope_mode?: EntityScopeMode;
  entity_resolution_sources?: string[];
  entity_context_count?: number;
}

export interface ChatMessageUser {
  id: string;
  role: 'user';
  content: string;
}

export interface ChatMessageAssistant {
  id: string;
  role: 'assistant';
  content: string;
  citations?: ChatCitation[];
  confidence?: ChatConfidence;
  effective_policy_scope?: string[];
  entity_scope_applied?: string[];
  entity_scope_mode?: EntityScopeMode;
  entity_resolution_sources?: string[];
  entity_context_count?: number;
}

export type ChatMessage = ChatMessageUser | ChatMessageAssistant;

export interface SourceInventorySummary {
  source_system: string;
  document_count: number;
  chunk_count: number;
  public_document_count: number;
  eigenx_document_count: number;
  latest_updated_at: string | null;
  sample_source_refs: string[];
}

export interface SourceInventoryResponse {
  generated_at: string;
  mode: 'all' | 'public';
  total_documents: number;
  total_chunks: number;
  sources: SourceInventorySummary[];
}
