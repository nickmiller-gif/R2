import { describe, expect, it } from 'vitest';
import { toOracleServiceLayerResultEnvelope } from '../../src/services/oracle/oracle-service-layer-api.service.js';
import type { OracleServiceLayerRun } from '../../src/types/oracle/service-layer.js';

function makeBaseRun(): Omit<OracleServiceLayerRun, 'status' | 'analysis' | 'errorMessage'> {
  return {
    id: 'run-123',
    entityAssetId: 'asset-123',
    runLabel: 'slice-08',
    triggeredBy: 'user-1',
    profileRunId: 'profile-1',
    whitespaceRunId: 'ws-1',
    metadata: {},
    createdAt: new Date('2026-04-06T00:00:00.000Z'),
    updatedAt: new Date('2026-04-06T01:00:00.000Z'),
  };
}

describe('toOracleServiceLayerResultEnvelope', () => {
  it('maps completed runs to completed envelope including summary', () => {
    const run: OracleServiceLayerRun = {
      ...makeBaseRun(),
      status: 'completed',
      errorMessage: null,
      analysis: {
        gaps: [],
        predictiveGaps: [],
        retrievalQualified: [],
        rescoreCandidates: [],
        verification: {
          consistent: true,
          contradictionWeight: 0,
          validationWeight: 1,
          contradictionRatio: 0,
          uncertaintyLevel: 'low',
        },
        contradictionSeverity: 'none',
        opportunity: { score: 42, confidence: 'medium', signalCount: 1 },
        opportunityTiming: [],
        temporalDrift: {
          trend: 'stable',
          totalDrift: 0,
          driftPerDay: 0,
          windowDays: 0,
        },
        runDiff: {
          added: [],
          removed: [],
          scoreDeltas: [],
          statusChanged: [],
        },
        reasoning: {
          consistent: true,
          contradictionRatio: 0,
          uncertaintyLevel: 'low',
          contradictionSeverity: 'none',
          retrievalQualifiedCount: 0,
          rescoreCandidateCount: 0,
        },
        temporalSignals: {
          trend: 'stable',
          driftPerDay: 0,
          windowDays: 0,
          staleEvidenceCount: 0,
          freshnessReferenceTime: '2026-04-06T01:00:00.000Z',
        },
        summary: {
          gapCount: 0,
          predictiveGapCount: 0,
          topPredictiveGapScore: null,
          retrievalQualifiedCount: 0,
          rescoreCandidateCount: 0,
          opportunityScore: 42,
          trend: 'stable',
          addedCount: 0,
          removedCount: 0,
        },
      },
    };

    const envelope = toOracleServiceLayerResultEnvelope(run);
    expect(envelope.status).toBe('completed');
    if (envelope.status === 'completed') {
      expect(envelope.summary).not.toBeNull();
      expect(envelope.summary?.opportunityScore).toBe(42);
      expect(envelope.analysis.summary.opportunityScore).toBe(42);
    }
  });

  it('maps failed runs and preserves error message fallback', () => {
    const run: OracleServiceLayerRun = {
      ...makeBaseRun(),
      status: 'failed',
      analysis: null,
      errorMessage: null,
    };

    const envelope = toOracleServiceLayerResultEnvelope(run);
    expect(envelope.status).toBe('failed');
    if (envelope.status === 'failed') {
      expect(envelope.errorMessage).toContain('failed');
    }
  });

  it('throws for completed runs with missing analysis payload', () => {
    const run: OracleServiceLayerRun = {
      ...makeBaseRun(),
      status: 'completed',
      analysis: null,
      errorMessage: null,
    };

    expect(() => toOracleServiceLayerResultEnvelope(run)).toThrow(/missing analysis payload/);
  });
});
