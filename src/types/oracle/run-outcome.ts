/**
 * Oracle Service-Layer Run Outcome — durable real-world result for whitespace runs.
 *
 * Closes the decision → outcome feedback loop. After an operator issues a
 * pursue/defer/dismiss decision, this record captures what actually happened:
 * revenue realized, whether the opportunity was won or lost, and when it closed.
 */

export type OracleRunOutcomeStatus = 'pursued' | 'deferred' | 'dismissed' | 'won' | 'lost';

export interface OracleServiceLayerRunOutcome {
  id: string;
  oracleServiceLayerRunId: string;
  outcomeStatus: OracleRunOutcomeStatus;
  outcomeNotes: string | null;
  outcomeRevenue: number | null;
  outcomeClosedAt: Date | null;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleServiceLayerRunOutcomeInput {
  oracleServiceLayerRunId: string;
  outcomeStatus: OracleRunOutcomeStatus;
  outcomeNotes?: string | null;
  outcomeRevenue?: number | null;
  outcomeClosedAt?: string | null;
  recordedBy: string;
}

export interface UpdateOracleServiceLayerRunOutcomeInput {
  outcomeStatus?: OracleRunOutcomeStatus;
  outcomeNotes?: string | null;
  outcomeRevenue?: number | null;
  outcomeClosedAt?: string | null;
}

export interface OracleServiceLayerRunOutcomeFilter {
  oracleServiceLayerRunId?: string;
  outcomeStatus?: OracleRunOutcomeStatus;
  recordedBy?: string;
}
