import type {
  OracleWhitespaceAnalysis,
  OracleWhitespaceAnalysisInput,
  OracleWhitespaceRunSummary,
} from './whitespace-core.js';
import type { OracleServiceLayerRunOutcome } from './run-outcome.js';

export type OracleServiceLayerRunStatus = 'running' | 'completed' | 'failed';
export type OracleOperatorDecisionStatus = 'pursue' | 'defer' | 'dismiss';

export interface OracleServiceLayerRunDecision {
  id: string;
  oracleServiceLayerRunId: string;
  decisionStatus: OracleOperatorDecisionStatus;
  notes: string | null;
  decidedBy: string;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

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


export interface OracleServiceLayerRunHistoryFilter {
  entityAssetId?: string;
  limit?: number;
}

export interface OracleServiceLayerRunHistoryItem {
  id: string;
  status: OracleServiceLayerRunStatus;
  entityAssetId: string;
  runLabel: string;
  createdAt: Date;
  updatedAt: Date;
  summary: OracleWhitespaceRunSummary | null;
  operatorDecision: OracleServiceLayerRunDecision | null;
  runOutcome: OracleServiceLayerRunOutcome | null;
}

export interface ExecuteOracleServiceLayerRunInput {
  entityAssetId: string;
  runLabel: string;
  triggeredBy: string;
  analysisInput: OracleWhitespaceAnalysisInput;
  metadata?: Record<string, unknown>;
}
