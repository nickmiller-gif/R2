/**
 * Oracle whitespace core contracts.
 *
 * Shared backend-only domain contracts for whitespace/gap reasoning,
 * retrieval-aware verification, temporal drift, freshness handling,
 * and opportunity modeling.
 */

import type {
  GapContext,
  TopicCoverage,
  WhitespaceGap,
} from '../../lib/oracle/whitespace.js';
import type { RetrievalResultItem } from '../../lib/oracle/retrieval-contract.js';
import type { EvidenceItemAge, RescoreCandidate } from '../../lib/oracle/evidence-freshness.js';
import type { OpportunitySignalInput, OpportunityScore, HorizonScore } from '../../lib/oracle/opportunity.js';
import type { RunScoreEntry, CrossRunDiff } from '../../lib/oracle/cross-run-diff.js';
import type {
  EvidenceWeightItem,
  VerificationResult,
  ContradictionSeverity,
} from '../../lib/oracle/verification.js';
import type { ScoreSnapshot, TemporalDrift } from '../../lib/oracle/temporal.js';

export interface OraclePredictiveGap extends WhitespaceGap {
  predictiveScore: number;
  context: GapContext;
}

export interface OracleWhitespaceAnalysisInput {
  coverage: TopicCoverage[];
  gapContextsByTopicId?: Record<string, GapContext>;
  retrievalResults?: RetrievalResultItem[];
  retrievalMinRelevance?: number;
  evidenceAges?: EvidenceItemAge[];
  freshnessReferenceTime?: Date;
  freshnessHalfLifeDays?: number;
  verificationEvidence?: EvidenceWeightItem[];
  opportunitySignals?: OpportunitySignalInput[];
  opportunityDaysToAction?: number;
  scoreSnapshots?: ScoreSnapshot[];
  previousRunEntries?: RunScoreEntry[];
  currentRunEntries?: RunScoreEntry[];
}

export interface OracleWhitespaceAnalysis {
  gaps: WhitespaceGap[];
  predictiveGaps: OraclePredictiveGap[];
  retrievalQualified: RetrievalResultItem[];
  rescoreCandidates: RescoreCandidate[];
  verification: VerificationResult;
  contradictionSeverity: ContradictionSeverity;
  opportunity: OpportunityScore;
  opportunityTiming: HorizonScore[];
  temporalDrift: TemporalDrift;
  runDiff: CrossRunDiff;
}

export interface OracleWhitespaceCoreRun {
  id: string;
  entityAssetId: string;
  runLabel: string;
  analysis: OracleWhitespaceAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleWhitespaceCoreRunInput {
  entityAssetId: string;
  runLabel: string;
  analysis: OracleWhitespaceAnalysis;
}
