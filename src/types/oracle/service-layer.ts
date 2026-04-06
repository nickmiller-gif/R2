import type {
  OracleWhitespaceAnalysis,
  OracleWhitespaceAnalysisInput,
  OracleWhitespaceRunSummary,
} from './whitespace-core.js';

export type OracleServiceLayerRunStatus = 'running' | 'completed' | 'failed';

interface OracleServiceLayerResultEnvelopeBase {
  runId: string;
  generatedAt: string;
}

export interface OracleServiceLayerRunningResultEnvelope
  extends OracleServiceLayerResultEnvelopeBase {
  status: 'running';
  summary: null;
  analysis: null;
  errorMessage: null;
}

export interface OracleServiceLayerCompletedResultEnvelope
  extends OracleServiceLayerResultEnvelopeBase {
  status: 'completed';
  summary: OracleWhitespaceRunSummary;
  analysis: OracleWhitespaceAnalysis;
  errorMessage: null;
}

export interface OracleServiceLayerFailedResultEnvelope
  extends OracleServiceLayerResultEnvelopeBase {
  status: 'failed';
  summary: null;
  analysis: null;
  errorMessage: string;
}

export type OracleServiceLayerResultEnvelope =
  | OracleServiceLayerRunningResultEnvelope
  | OracleServiceLayerCompletedResultEnvelope
  | OracleServiceLayerFailedResultEnvelope;

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
