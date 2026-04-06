/**
 * Eigen adapter for reading Oracle whitespace service-layer runs.
 *
 * Preserves domain boundaries by consuming Oracle run output via Oracle service
 * contracts, then normalizing into an Eigen-owned model.
 */

import { toOracleServiceLayerResultEnvelope } from '../oracle/oracle-service-layer-api.service.js';
import type { OracleServiceLayerRun } from '../../types/oracle/index.js';
import type {
  EigenOracleWhitespaceIntelligence,
  EigenOracleWhitespaceIntelligencePayload,
} from '../../types/eigen/oracle-whitespace-intelligence.js';

export interface EigenOracleWhitespaceReaderService {
  getWhitespaceIntelligenceByRunId(runId: string): Promise<EigenOracleWhitespaceIntelligence | null>;
}

export interface EigenOracleWhitespaceReaderDeps {
  oracleServiceLayer: {
    getRunById(id: string): Promise<OracleServiceLayerRun | null>;
  };
}

function toEigenPayload(run: OracleServiceLayerRun): EigenOracleWhitespaceIntelligencePayload {
  if (!run.analysis) {
    throw new Error('Oracle completed run is missing analysis payload');
  }

  const topPredictiveGaps = [...run.analysis.predictiveGaps]
    .sort((a, b) => b.predictiveScore - a.predictiveScore)
    .slice(0, 3)
    .map((gap) => ({
      topicId: gap.topicId,
      predictiveScore: gap.predictiveScore,
      priority: gap.priority,
    }));

  return {
    gapCount: run.analysis.summary.gapCount,
    predictiveGapCount: run.analysis.summary.predictiveGapCount,
    retrievalQualifiedCount: run.analysis.summary.retrievalQualifiedCount,
    topPredictiveGapScore: run.analysis.summary.topPredictiveGapScore,
    trend: run.analysis.summary.trend,
    opportunityScore: run.analysis.summary.opportunityScore,
    topPredictiveGaps,
  };
}

export function createEigenOracleWhitespaceReaderService(
  deps: EigenOracleWhitespaceReaderDeps,
): EigenOracleWhitespaceReaderService {
  return {
    async getWhitespaceIntelligenceByRunId(runId) {
      const run = await deps.oracleServiceLayer.getRunById(runId);
      if (!run) {
        return null;
      }

      const envelope = toOracleServiceLayerResultEnvelope(run);

      return {
        runId: envelope.runId,
        status: envelope.status,
        generatedAt: envelope.generatedAt,
        payload: envelope.status === 'completed' ? toEigenPayload(run) : null,
        errorMessage: envelope.errorMessage,
      };
    },
  };
}
