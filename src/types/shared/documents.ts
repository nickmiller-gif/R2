/**
 * Shared documents table types — the canonical store for transcripts,
 * summaries, reports, and any text artifact that Eigen will index.
 *
 * Follows CentralR2 schema posture: shared identity + provenance + indexing lifecycle.
 */

export type DocumentStatus = 'draft' | 'active' | 'archived' | 'deleted';

export type IndexStatus = 'pending' | 'indexed' | 'failed' | 'stale';
export type EmbeddingStatus = 'pending' | 'embedded' | 'failed' | 'stale';
export type ExtractedTextStatus = 'pending' | 'extracted' | 'failed' | 'not_applicable';

export interface Document {
  id: string;
  /** The product domain that created this document (e.g., 'rays_retreat', 'charter'). */
  sourceSystem: string;
  /**
   * Domain-stable external id when set (e.g. analysis run id). Unique with sourceSystem for Eigen ingest.
   */
  sourceRef: string | null;
  /** Owner — MEG entity ID. */
  ownerId: string;
  /** Human-readable title. */
  title: string;
  /** Document body / content. */
  body: string;
  /** MIME type or content kind (e.g., 'text/plain', 'text/markdown', 'application/pdf'). */
  contentType: string;
  status: DocumentStatus;

  // ─── Provenance fields ───────────────────────────────────────────
  /** URI to original source (if external). */
  sourceUrl: string | null;
  /** Title of the original source. */
  sourceTitle: string | null;
  /** When the content was originally captured. */
  capturedAt: Date | null;
  /** Confidence in the source (0.0–1.0, null if not assessed). */
  confidence: number | null;

  // ─── Eigen-ready indexing lifecycle ──────────────────────────────
  /** SHA-256 of body for dedup and change detection. */
  contentHash: string;
  /** Full-text index status. */
  indexStatus: IndexStatus;
  /** When the document was last indexed. */
  indexedAt: Date | null;
  /** Vector embedding status. */
  embeddingStatus: EmbeddingStatus;
  /** Reference to the vector store entry (e.g., vector ID or collection:id). */
  vectorStoreRef: string | null;
  /** Text extraction status (for non-text documents like PDFs). */
  extractedTextStatus: ExtractedTextStatus;

  // ─── Timestamps ──────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  sourceSystem: string;
  ownerId: string;
  title: string;
  body: string;
  contentType?: string;
  sourceRef?: string | null;
  sourceUrl?: string;
  sourceTitle?: string;
  capturedAt?: Date;
  confidence?: number;
}

export interface UpdateDocumentInput {
  title?: string;
  body?: string;
  status?: DocumentStatus;
  sourceUrl?: string;
  sourceTitle?: string;
  confidence?: number;
}

export interface DocumentFilter {
  sourceSystem?: string;
  ownerId?: string;
  status?: DocumentStatus;
  contentType?: string;
  indexStatus?: IndexStatus;
  embeddingStatus?: EmbeddingStatus;
}
