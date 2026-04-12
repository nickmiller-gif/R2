/**
 * Oracle Thesis — the core analytical primitive.
 */
import type {
  OracleGovernanceMetadata,
  OracleThesisStatus,
  OracleNoveltyStatus,
  OraclePublicationState,
} from './shared.js';

export interface OracleThesis {
  id: string;
  profileId: string | null;
  /** Optional FK to MEG canonical identity — the real-world subject this thesis is about. */
  megEntityId: string | null;
  title: string;
  thesisStatement: string;
  status: OracleThesisStatus;
  noveltyStatus: OracleNoveltyStatus;
  duplicateOfThesisId: string | null;
  supersededByThesisId: string | null;

  // Inspiration/context lane references (non-validating)
  inspirationSignalIds: string[];
  inspirationEvidenceItemIds: string[];

  // Validation lane references (primary support/contradiction)
  validationEvidenceItemIds: string[];
  contradictionEvidenceItemIds: string[];

  confidence: number;
  evidenceStrength: number;
  uncertaintySummary: string | null;

  // Publication workflow
  publicationState: OraclePublicationState;
  publishedAt: Date | null;
  publishedBy: string | null;
  lastDecisionAt: Date | null;
  lastDecisionBy: string | null;
  decisionMetadata: Record<string, unknown>;
  metadata: Record<string, unknown>;

  // Governance
  governance: OracleGovernanceMetadata;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleThesisInput {
  profileId?: string | null;
  /** Optional MEG entity this thesis is about. */
  megEntityId?: string | null;
  title: string;
  thesisStatement: string;
  status?: OracleThesisStatus;
  noveltyStatus?: OracleNoveltyStatus;
  confidence?: number;
  evidenceStrength?: number;
  uncertaintySummary?: string | null;
  metadata?: Record<string, unknown>;
  governance?: OracleGovernanceMetadata;
}

export interface UpdateOracleThesisInput {
  title?: string;
  thesisStatement?: string;
  megEntityId?: string | null;
  status?: OracleThesisStatus;
  noveltyStatus?: OracleNoveltyStatus;
  confidence?: number;
  evidenceStrength?: number;
  uncertaintySummary?: string | null;
  publicationState?: OraclePublicationState;
  metadata?: Record<string, unknown>;
}

export interface OracleThesisFilter {
  profileId?: string;
  /** Filter theses by the MEG entity they are about. */
  megEntityId?: string;
  status?: OracleThesisStatus;
  noveltyStatus?: OracleNoveltyStatus;
  publicationState?: OraclePublicationState;
  minConfidence?: number;
  maxConfidence?: number;
  limit?: number;
  offset?: number;
}
