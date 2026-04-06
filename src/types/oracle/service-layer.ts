import type { OracleWhitespaceAnalysis, OracleWhitespaceAnalysisInput } from './whitespace-core.js';

export type OracleServiceLayerRunStatus = 'completed' | 'failed';

export interface OracleServiceLayerRun {
  id: string;
  entityAssetId: string;
  runLabel: string;
  triggeredBy: string;
  profileRunId: string;
  whitespaceRunId: string | null;
  status: OracleServiceLayerRunStatus;
  analysis: OracleWhitespaceAnalysis | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecuteOracleServiceLayerRunInput {
  entityAssetId: string;
  runLabel: string;
  triggeredBy: string;
  analysisInput: OracleWhitespaceAnalysisInput;
  metadata?: Record<string, unknown>;
}
