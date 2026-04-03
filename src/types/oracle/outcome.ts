/**
 * Oracle Outcome — real-world result tracking for thesis validation.
 *
 * Outcomes close the intelligence feedback loop (Gap #3). When a thesis
 * makes a prediction or claim, outcomes record what actually happened,
 * allowing the system to score predictive accuracy and recalibrate
 * confidence in thesis authors, evidence sources, and signal types.
 */

export type OutcomeVerdict = 'confirmed' | 'partially_confirmed' | 'refuted' | 'inconclusive' | 'pending';

export type OutcomeSource = 'manual' | 'automated' | 'external_feed' | 'domain_event';

export interface OracleOutcome {
  id: string;
  thesisId: string;
  profileId: string | null;
  verdict: OutcomeVerdict;
  outcomeSource: OutcomeSource;
  observedAt: Date;
  summary: string;
  evidenceRefs: string[];
  accuracyScore: number | null;
  confidenceDelta: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleOutcomeInput {
  thesisId: string;
  profileId?: string | null;
  verdict: OutcomeVerdict;
  outcomeSource?: OutcomeSource;
  observedAt?: string;
  summary: string;
  evidenceRefs?: string[];
  accuracyScore?: number | null;
  confidenceDelta?: number | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateOracleOutcomeInput {
  verdict?: OutcomeVerdict;
  summary?: string;
  accuracyScore?: number | null;
  confidenceDelta?: number | null;
  evidenceRefs?: string[];
  metadata?: Record<string, unknown>;
}

export interface OracleOutcomeFilter {
  thesisId?: string;
  profileId?: string;
  verdict?: OutcomeVerdict;
  outcomeSource?: OutcomeSource;
}
