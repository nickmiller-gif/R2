export type LlmProvider = 'openai' | 'anthropic' | 'perplexity';
export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type CitationAuthorityTier = 'user_upload' | 'oracle' | 'charter' | 'web' | 'corpus';

export interface ChatConfidence {
  overall: ConfidenceLabel;
  retrieval: ConfidenceLabel;
  upload_support: ConfidenceLabel;
  model_agreement?: ConfidenceLabel;
  signals: {
    citation_count: number;
    avg_relevance: number;
    upload_ratio: number;
  };
}

export interface ChatResponse {
  response: string;
  citations: Array<{
    chunk_id: string;
    source: string;
    section?: string;
    relevance: number;
    authority_tier: CitationAuthorityTier;
  }>;
  confidence: ChatConfidence;
  retrieval_run_id: string | null;
  memory_updated: boolean;
  session_id: string;
  llm_provider?: LlmProvider;
  llm_model?: string | null;
  llm_fallback_used?: boolean;
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
  streaming?: boolean;
  citations?: ChatResponse['citations'];
  confidence?: ChatResponse['confidence'];
  retrieval_run_id?: string | null;
  llm_provider?: ChatResponse['llm_provider'];
  llm_model?: ChatResponse['llm_model'];
  llm_fallback_used?: ChatResponse['llm_fallback_used'];
}

export type ChatMessage = ChatMessageUser | ChatMessageAssistant;

export type IngestCorpusTier = 'eigenx' | 'public';
export type ChatTier = 'eigenx' | 'public';

export interface IngestResponse {
  document_id: string;
  ingestion_run_id: string;
  chunks_created: number;
  content_unchanged?: boolean;
  idempotent_replay?: boolean;
}

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
