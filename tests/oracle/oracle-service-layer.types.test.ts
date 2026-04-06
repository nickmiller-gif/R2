import { describe, expect, it } from 'vitest';
import type { OracleServiceLayerResultEnvelope } from '../../src/types/oracle/service-layer.js';

describe('Oracle service-layer result envelope type', () => {
  it('captures completed and failed Oracle run result contracts', () => {
    const completed: OracleServiceLayerResultEnvelope = {
      runId: 'run-1',
      status: 'completed',
      generatedAt: '2026-04-06T00:00:00.000Z',
      summary: {
        gapCount: 1,
        predictiveGapCount: 1,
        topPredictiveGapScore: 85,
        retrievalQualifiedCount: 2,
        rescoreCandidateCount: 1,
        opportunityScore: 77,
        trend: 'rising',
        addedCount: 1,
        removedCount: 0,
      },
      analysis: null,
      errorMessage: null,
    };

    const failed: OracleServiceLayerResultEnvelope = {
      runId: 'run-2',
      status: 'failed',
      generatedAt: '2026-04-06T00:00:00.000Z',
      summary: null,
      analysis: null,
      errorMessage: 'analysis blew up',
    };

    expect(completed.summary?.opportunityScore).toBe(77);
    expect(failed.errorMessage).toContain('blew up');
  });
});
