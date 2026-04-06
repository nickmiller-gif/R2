import type {
  OracleServiceLayerResultEnvelope,
  OracleServiceLayerRun,
} from '../../types/oracle/index.js';

/**
 * Maps a persisted Oracle service-layer run to the stable API envelope contract.
 */
export function toOracleServiceLayerResultEnvelope(
  run: OracleServiceLayerRun,
): OracleServiceLayerResultEnvelope {
  const generatedAt = run.updatedAt.toISOString();

  if (run.status === 'completed') {
    if (!run.analysis) {
      throw new Error('Completed service-layer run is missing analysis payload');
    }
    if (!run.analysis.summary) {
      throw new Error('Completed service-layer run analysis is missing summary');
    }
    return {
      runId: run.id,
      generatedAt,
      status: 'completed',
      summary: run.analysis.summary,
      analysis: run.analysis,
      errorMessage: null,
    };
  }

  if (run.status === 'failed') {
    return {
      runId: run.id,
      generatedAt,
      status: 'failed',
      summary: null,
      analysis: null,
      errorMessage: run.errorMessage ?? 'Oracle service-layer run failed',
    };
  }

  return {
    runId: run.id,
    generatedAt,
    status: 'running',
    summary: null,
    analysis: null,
    errorMessage: null,
  };
}
