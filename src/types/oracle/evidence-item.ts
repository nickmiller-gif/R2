/**
 * Oracle Evidence Item — supporting or contradicting evidence for theses.
 */
import type {
  OracleGovernanceMetadata,
  OracleSourceLane,
  OracleSourceClass,
} from './shared.js';

export interface OracleEvidenceItem {
  id: string;
  signalId: string | null;
  claimId: string | null;
  sourceLane: OracleSourceLane;
  sourceClass: OracleSourceClass;
  citationRef: string | null;
  excerpt: string | null;
  evidenceStrength: number;
  confidence: number;
  uncertaintySummary: string | null;
  metadata: Record<string, unknown>;
  governance: OracleGovernanceMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleEvidenceItemInput {
  signalId?: string | null;
  claimId?: string | null;
  sourceLane: OracleSourceLane;
  sourceClass: OracleSourceClass;
  citationRef?: string | null;
  excerpt?: string | null;
  evidenceStrength?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
  governance?: OracleGovernanceMetadata;
}

export interface UpdateOracleEvidenceItemInput {
  evidenceStrength?: number;
  confidence?: number;
  uncertaintySummary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OracleEvidenceItemFilter {
  signalId?: string;
  sourceLane?: OracleSourceLane;
  sourceClass?: OracleSourceClass;
  minStrength?: number;
}
