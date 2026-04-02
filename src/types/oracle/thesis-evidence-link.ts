/**
 * Oracle Thesis-Evidence Link — tracks roles of evidence items for theses.
 */
import type { OracleThesisEvidenceRole } from './shared.js';

export interface OracleThesisEvidenceLink {
  id: string;
  thesisId: string;
  evidenceItemId: string;
  role: OracleThesisEvidenceRole;
  weight: number;
  notes: string | null;
  createdAt: Date;
}

export interface CreateThesisEvidenceLinkInput {
  thesisId: string;
  evidenceItemId: string;
  role: OracleThesisEvidenceRole;
  weight?: number;
  notes?: string | null;
}
