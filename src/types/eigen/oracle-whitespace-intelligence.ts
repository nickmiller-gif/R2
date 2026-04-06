/**
 * Eigen contract for Oracle-derived whitespace intelligence.
 *
 * Eigen consumes Oracle output through this normalized service contract,
 * not through Oracle persistence rows.
 */

export type EigenOracleWhitespaceIntelligenceStatus = 'running' | 'completed' | 'failed';

export interface EigenOraclePredictiveGap {
  topicId: string;
  predictiveScore: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface EigenOracleWhitespaceIntelligencePayload {
  gapCount: number;
  predictiveGapCount: number;
  retrievalQualifiedCount: number;
  topPredictiveGapScore: number | null;
  trend: 'rising' | 'falling' | 'stable';
  opportunityScore: number;
  topPredictiveGaps: EigenOraclePredictiveGap[];
}

export interface EigenOracleWhitespaceIntelligence {
  runId: string;
  status: EigenOracleWhitespaceIntelligenceStatus;
  generatedAt: string;
  payload: EigenOracleWhitespaceIntelligencePayload | null;
  errorMessage: string | null;
}
