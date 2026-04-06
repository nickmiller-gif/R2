import type {
  OracleWhitespaceAnalysis,
  OracleWhitespaceAnalysisInput,
  OracleWhitespaceRunSummary,
} from './whitespace-core.js';

export type OracleServiceLayerRunStatus = 'running' | 'completed' | 'failed';

export interface OracleServiceLayerResultEnvelope {
  runId: string;
  status: OracleServiceLayerRunStatus;
  generatedAt: string;
  summary: OracleWhitespaceRunSummary | null;
  analysis: OracleWhitespaceAnalysis | null;
  errorMessage: string | null;
}

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
