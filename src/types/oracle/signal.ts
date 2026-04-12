/**
 * Oracle signal types — the intelligence layer's scored assessment output.
 *
 * Oracle reads evidence (documents, market intel) and produces signals
 * with explicit scoring, confidence, and reason traces.
 * Any product domain can request and consume signals.
 */
import type { OraclePublicationState } from './shared.js';

export type SignalStatus = 'pending' | 'scored' | 'expired' | 'superseded';

export type ConfidenceBand = 'high' | 'medium' | 'low';

export interface OracleSignal {
  id: string;
  /** The entity this signal scores (asset registry ID). */
  entityAssetId: string;
  /** Normalized score (0–100). */
  score: number;
  /** Confidence band with rationale. */
  confidence: ConfidenceBand;
  /** Top reasons for the score (max 5). */
  reasons: string[];
  /** Tags for categorization and retrieval. */
  tags: string[];
  status: SignalStatus;
  /** Link to the primary analysis artifact (document ID). */
  analysisDocumentId: string | null;
  /** Link to the source evidence (e.g., idea_submission asset ID). */
  sourceAssetId: string | null;
  /** Provenance: which Oracle run/model produced this. */
  producerRef: string;
  /** Version — Oracle can re-score, creating new versions. */
  version: number;
  publicationState: OraclePublicationState;
  publishedAt: Date | null;
  publishedBy: string | null;
  publicationNotes: string | null;
  scoredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleSignalInput {
  entityAssetId: string;
  score: number;
  confidence: ConfidenceBand;
  reasons: string[];
  tags?: string[];
  analysisDocumentId?: string;
  sourceAssetId?: string;
  producerRef: string;
}

export interface UpdateOracleSignalInput {
  score?: number;
  confidence?: ConfidenceBand;
  reasons?: string[];
  tags?: string[];
  status?: SignalStatus;
  publicationState?: OraclePublicationState;
  publicationNotes?: string | null;
}

export interface OracleSignalFilter {
  entityAssetId?: string;
  status?: SignalStatus;
  confidence?: ConfidenceBand;
  minScore?: number;
  maxScore?: number;
  producerRef?: string;
  tags?: string[];
  publicationState?: OraclePublicationState;
  limit?: number;
  offset?: number;
}
