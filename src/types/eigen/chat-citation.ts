/**
 * Persistent Eigen chat citations (E4) — audit-grade links from turns to chunks.
 */

export type CitationAuthorityTier = 'user_upload' | 'oracle' | 'charter' | 'web' | 'corpus';
export type ChatEvidenceTier = 'A' | 'B' | 'C' | 'D';

export interface EigenChatCitation {
  id: string;
  chatTurnId: string;
  ownerId: string;
  chunkId: string | null;
  rankIndex: number;
  source: string;
  section: string | null;
  relevance: number;
  authorityTier: CitationAuthorityTier;
  evidenceTier: ChatEvidenceTier;
  policyDecisionId: string | null;
  retrievalRunId: string | null;
  createdAt: Date;
}

export interface PersistEigenChatCitationInput {
  chunkId: string;
  source: string;
  section?: string;
  relevance: number;
  authorityTier: CitationAuthorityTier;
  evidenceTier: ChatEvidenceTier;
  rankIndex: number;
}

export interface PersistEigenChatCitationsForTurnInput {
  chatTurnId: string;
  ownerId: string;
  retrievalRunId?: string | null;
  policyDecisionId?: string | null;
  citations: PersistEigenChatCitationInput[];
}

/** Client-facing citation with stable id for audit and UI panels. */
export interface ChatCitationWithId {
  citation_id: string;
  chunk_id: string;
  source: string;
  section?: string;
  relevance: number;
  authority_tier: CitationAuthorityTier;
  evidence_tier: ChatEvidenceTier;
}
