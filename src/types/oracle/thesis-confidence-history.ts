/**
 * Oracle Thesis Confidence History — audit trail for thesis confidence
 * recalibration events triggered by new evidence or recorded outcomes.
 */

export type RecalibrationSource = 'evidence_link' | 'outcome';

export interface OracleThesisConfidenceHistoryEntry {
  id: string;
  thesisId: string;
  priorConfidence: number;
  newConfidence: number;
  delta: number;
  source: RecalibrationSource;
  evidenceLinkId: string | null;
  outcomeId: string | null;
  recalibrationMethod: string;
  logOddsShift: number;
  reason: string | null;
  actor: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
