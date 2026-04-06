/**
 * Oracle whitespace core contracts.
 *
 * Backend-only Oracle domain contracts for whitespace and opportunity analysis.
 * This is an Oracle-owned type layer that intentionally avoids exposing
 * low-level lib/oracle primitive interfaces as the public model.
 */

import type { ConfidenceBand } from './signal.js';
import type { OracleSourceLane, OracleThesisEvidenceRole } from './shared.js';

export type OracleWhitespaceGapPriority = 'critical' | 'high' | 'medium' | 'low';

export interface OracleWhitespaceTopicCoverage {
  topicId: string;
  coverageScore: number;
  evidenceCount: number;
}

export interface OracleWhitespaceGap {
  topicId: string;
  gapScore: number;
  priority: OracleWhitespaceGapPriority;
}

export interface OracleWhitespaceGapContext {
  topicImportance: number;
  recencyFactor: number;
  closureEase: number;
}

export interface OracleWhitespaceRetrievalItem {
  id: string;
  relevance: number;
  sourceLane: OracleSourceLane;
  excerpt: string;
  metadata: Record<string, unknown>;
}

export type OracleEvidenceFreshnessLabel = 'fresh' | 'aging' | 'stale' | 'expired';

export interface OracleFreshnessSnapshot {
  ageDays: number;
  freshnessScore: number;
  label: OracleEvidenceFreshnessLabel;
}

export interface OracleFreshnessEvidenceAge {
  id: string;
  createdAt: Date;
}

export interface OracleFreshnessRescoreCandidate {
  id: string;
  freshness: OracleFreshnessSnapshot;
}

export interface OracleOpportunitySignal {
  score: number;
  weight: number;
  tags?: string[];
}

export interface OracleOpportunityCandidate {
  score: number;
  confidence: ConfidenceBand;
  signalCount: number;
}

export type OracleOpportunityHorizon = 'immediate' | 'near' | 'medium' | 'long';

export interface OracleOpportunityPlay {
  horizon: OracleOpportunityHorizon;
  weightedScore: number;
  proximityFactor: number;
}

export interface OracleRunScoreEntry {
  id: string;
  score: number;
  status: string;
}

export type OracleScoreChangeSeverity = 'none' | 'minor' | 'significant' | 'major';

export interface OracleRunScoreDelta {
  id: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: OracleScoreChangeSeverity;
}

export interface OracleRunStatusChange {
  id: string;
  previousStatus: string;
  currentStatus: string;
}

export interface OracleRunDiff {
  scoreDeltas: OracleRunScoreDelta[];
  added: string[];
  removed: string[];
  statusChanged: OracleRunStatusChange[];
}

export interface OracleReasoningEvidenceWeight {
  role: OracleThesisEvidenceRole;
  weight: number;
}

export type OracleUncertaintyLevel = 'low' | 'medium' | 'high';
export type OracleContradictionSeverity = 'none' | 'minor' | 'major' | 'fatal';

export interface OracleVerificationResult {
  consistent: boolean;
  validationWeight: number;
  contradictionWeight: number;
  contradictionRatio: number;
  uncertaintyLevel: OracleUncertaintyLevel;
}

export interface OracleTemporalScoreSnapshot {
  recordedAt: Date;
  score: number;
}

export type OracleTemporalTrend = 'rising' | 'falling' | 'stable';

export interface OracleTemporalDriftSignal {
  totalDrift: number;
  driftPerDay: number;
  trend: OracleTemporalTrend;
  windowDays: number;
}

export interface OraclePredictiveGap extends OracleWhitespaceGap {
  predictiveScore: number;
  context: OracleWhitespaceGapContext;
}

export interface OracleEvidenceAwareReasoning {
  consistent: boolean;
  contradictionRatio: number;
  uncertaintyLevel: OracleUncertaintyLevel;
  contradictionSeverity: OracleContradictionSeverity;
  retrievalQualifiedCount: number;
  rescoreCandidateCount: number;
}

export interface OracleTemporalFreshnessSignals {
  trend: OracleTemporalTrend;
  driftPerDay: number;
  windowDays: number;
  staleEvidenceCount: number;
  freshnessReferenceTime: string;
}

export interface OracleWhitespaceRunSummary {
  gapCount: number;
  predictiveGapCount: number;
  topPredictiveGapScore: number | null;
  retrievalQualifiedCount: number;
  rescoreCandidateCount: number;
  opportunityScore: number;
  trend: OracleTemporalTrend;
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
  verification: OracleVerificationResult;
  contradictionSeverity: OracleContradictionSeverity;
  opportunity: OracleOpportunityCandidate;
  opportunityTiming: OracleOpportunityPlay[];
  temporalDrift: OracleTemporalDriftSignal;
  runDiff: OracleRunDiff;
  reasoning: OracleEvidenceAwareReasoning;
  temporalSignals: OracleTemporalFreshnessSignals;
  summary: OracleWhitespaceRunSummary;
}

export interface OracleWhitespaceAnalysisResultEnvelope {
  analysis: OracleWhitespaceAnalysis;
  summary: OracleWhitespaceRunSummary;
  generatedAt: string;
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
