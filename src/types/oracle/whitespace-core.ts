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

export type OracleWhitespaceTopicCoverage = TopicCoverage;
export type OracleWhitespaceGap = WhitespaceGap;
export type OracleWhitespaceGapContext = GapContext;
export type OracleWhitespaceRetrievalItem = RetrievalResultItem;
export type OracleFreshnessEvidenceAge = EvidenceItemAge;
export type OracleFreshnessRescoreCandidate = RescoreCandidate;
export type OracleOpportunitySignal = OpportunitySignalInput;
export type OracleOpportunityCandidate = OpportunityScore;
export type OracleOpportunityPlay = HorizonScore;
export type OracleRunScoreEntry = RunScoreEntry;
export type OracleRunDiff = CrossRunDiff;
export type OracleReasoningEvidenceWeight = EvidenceWeightItem;
export type OracleTemporalScoreSnapshot = ScoreSnapshot;
export type OracleTemporalDriftSignal = TemporalDrift;

export interface OraclePredictiveGap extends WhitespaceGap {
  predictiveScore: number;
  context: GapContext;
}

export interface OracleEvidenceAwareReasoning {
  consistent: boolean;
  contradictionRatio: number;
  uncertaintyLevel: VerificationResult['uncertaintyLevel'];
  contradictionSeverity: ContradictionSeverity;
  retrievalQualifiedCount: number;
  rescoreCandidateCount: number;
}

export interface OracleTemporalFreshnessSignals {
  trend: TemporalDrift['trend'];
  driftPerDay: number;
  windowDays: number;
  staleEvidenceCount: number;
  freshnessReferenceTime: Date;
}

export interface OracleWhitespaceRunSummary {
  gapCount: number;
  predictiveGapCount: number;
  topPredictiveGapScore: number | null;
  retrievalQualifiedCount: number;
  rescoreCandidateCount: number;
  opportunityScore: number;
  trend: TemporalDrift['trend'];
  addedCount: number;
  removedCount: number;
}

export interface OracleWhitespaceAnalysisInput {
  coverage: OracleWhitespaceTopicCoverage[];
  gapContextsByTopicId?: Record<string, OracleWhitespaceGapContext>;
  retrievalResults?: OracleWhitespaceRetrievalItem[];
  retrievalMinRelevance?: number;
  evidenceAges?: OracleFreshnessEvidenceAge[];
  freshnessReferenceTime?: Date;
  freshnessHalfLifeDays?: number;
  verificationEvidence?: OracleReasoningEvidenceWeight[];
  opportunitySignals?: OracleOpportunitySignal[];
  opportunityDaysToAction?: number;
  scoreSnapshots?: OracleTemporalScoreSnapshot[];
  previousRunEntries?: OracleRunScoreEntry[];
  currentRunEntries?: OracleRunScoreEntry[];
}

export interface OracleWhitespaceAnalysis {
  gaps: OracleWhitespaceGap[];
  predictiveGaps: OraclePredictiveGap[];
  retrievalQualified: OracleWhitespaceRetrievalItem[];
  rescoreCandidates: OracleFreshnessRescoreCandidate[];
  verification: VerificationResult;
  contradictionSeverity: ContradictionSeverity;
  opportunity: OracleOpportunityCandidate;
  opportunityTiming: OracleOpportunityPlay[];
  temporalDrift: OracleTemporalDriftSignal;
  runDiff: OracleRunDiff;
  reasoning: OracleEvidenceAwareReasoning;
  temporalSignals: OracleTemporalFreshnessSignals;
  summary: OracleWhitespaceRunSummary;
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
