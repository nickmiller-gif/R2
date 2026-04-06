/**
 * Eigen adapter for reading Oracle whitespace service-layer runs.
 *
 * Preserves domain boundaries by consuming Oracle run output via Oracle service
 * contracts, then normalizing into an Eigen-owned model.
 */

import { toOracleServiceLayerResultEnvelope } from '../oracle/oracle-service-layer-api.service.js';
import type {
  OracleServiceLayerRun,
  OracleServiceLayerCompletedResultEnvelope,
} from '../../types/oracle/index.js';
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

function toEigenPayload(
  envelope: OracleServiceLayerCompletedResultEnvelope,
): EigenOracleWhitespaceIntelligencePayload {
  const topPredictiveGaps = [...envelope.analysis.predictiveGaps]
    .sort((a, b) => b.predictiveScore - a.predictiveScore)
    .slice(0, 3)
    .map((gap) => ({
      topicId: gap.topicId,
      predictiveScore: gap.predictiveScore,
      priority: gap.priority,
    }));

  return {
    gapCount: envelope.summary.gapCount,
    predictiveGapCount: envelope.summary.predictiveGapCount,
    retrievalQualifiedCount: envelope.summary.retrievalQualifiedCount,
    topPredictiveGapScore: envelope.summary.topPredictiveGapScore,
    trend: envelope.summary.trend,
    opportunityScore: envelope.summary.opportunityScore,
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

      let envelope;
      try {
        envelope = toOracleServiceLayerResultEnvelope(run);
      } catch (err) {
        return {
          runId: run.id,
          status: 'failed',
          generatedAt: run.updatedAt.toISOString(),
          payload: null,
          errorMessage: err instanceof Error ? err.message : 'Unknown error normalizing Oracle run',
        };
      }

      return {
        runId: envelope.runId,
        status: envelope.status,
        generatedAt: envelope.generatedAt,
        payload: envelope.status === 'completed' ? toEigenPayload(envelope) : null,
        errorMessage: envelope.errorMessage,
      };
    },
  };
}
