/**
 * Oracle Thesis Confidence History — audit trail for thesis confidence
 * recalibration events triggered by new evidence or recorded outcomes.
 */

import type { OracleThesisEvidenceRole } from './shared.ts';

export type RecalibrationSource = 'evidence_link' | 'outcome';

export interface OracleThesisConfidenceHistoryEntry {
  id: string;
  thesisId: string;
  priorConfidence: number;
  newConfidence: number;
  delta: number;
  source: RecalibrationSource;
  /**
   * Evidence item that triggered this recalibration. Paired with
   * `evidenceRole` to identify the specific `oracle_thesis_evidence_links`
   * row (which has a composite PK and no surrogate id).
   */
  evidenceItemId: string | null;
  evidenceRole: OracleThesisEvidenceRole | null;
  outcomeId: string | null;
  recalibrationMethod: string;
  logOddsShift: number;
  reason: string | null;
  actor: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
