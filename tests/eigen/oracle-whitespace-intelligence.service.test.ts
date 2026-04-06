import { describe, expect, it } from 'vitest';
import { createEigenOracleWhitespaceReaderService } from '../../src/services/eigen/oracle-whitespace-intelligence.service.js';
import type { OracleServiceLayerRun } from '../../src/types/oracle/service-layer.js';
import type { OracleWhitespaceAnalysis } from '../../src/types/oracle/whitespace-core.js';

function makeAnalysis(): OracleWhitespaceAnalysis {
  return {
    gaps: [
      {
        topicId: 'pricing',
        gapScore: 80,
        priority: 'critical',
      },
    ],
    predictiveGaps: [
      {
        topicId: 'pricing',
        gapScore: 80,
        priority: 'critical',
        predictiveScore: 91,
        context: { topicImportance: 90, recencyFactor: 0.2, closureEase: 0.7 },
      },
      {
        topicId: 'distribution',
        gapScore: 74,
        priority: 'high',
        predictiveScore: 82,
        context: { topicImportance: 70, recencyFactor: 0.4, closureEase: 0.5 },
      },
      {
        topicId: 'support',
        gapScore: 56,
        priority: 'medium',
        predictiveScore: 68,
        context: { topicImportance: 50, recencyFactor: 0.5, closureEase: 0.8 },
      },
      {
        topicId: 'onboarding',
        gapScore: 38,
        priority: 'low',
        predictiveScore: 44,
        context: { topicImportance: 40, recencyFactor: 0.8, closureEase: 0.8 },
      },
    ],
    retrievalQualified: [{
      id: 'r1',
      relevance: 0.9,
      sourceLane: 'external_authoritative',
      excerpt: 'A useful signal',
      metadata: {},
    }],
    rescoreCandidates: [],
    verification: {
      consistent: true,
      contradictionWeight: 0,
      validationWeight: 0.8,
      contradictionRatio: 0,
      uncertaintyLevel: 'low',
    },
    contradictionSeverity: 'none',
    opportunity: {
      score: 88,
      confidence: 'high',
      signalCount: 2,
    },
    opportunityTiming: [
      {
        horizon: 'near',
        weightedScore: 78,
        proximityFactor: 0.8,
      },
    ],
    temporalDrift: {
      trend: 'rising',
      totalDrift: 6,
      driftPerDay: 0.3,
      windowDays: 20,
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
      retrievalQualifiedCount: 1,
      rescoreCandidateCount: 0,
    },
    temporalSignals: {
      trend: 'rising',
      driftPerDay: 0.3,
      windowDays: 20,
      staleEvidenceCount: 0,
      freshnessReferenceTime: '2026-04-06T00:00:00.000Z',
    },
    summary: {
      gapCount: 1,
      predictiveGapCount: 4,
      topPredictiveGapScore: 91,
      retrievalQualifiedCount: 1,
      rescoreCandidateCount: 0,
      opportunityScore: 88,
      trend: 'rising',
      addedCount: 0,
      removedCount: 0,
    },
  };
}

function makeServiceLayerRun(overrides?: Partial<OracleServiceLayerRun>): OracleServiceLayerRun {
  return {
    id: 'oracle-run-1',
    entityAssetId: '00000000-0000-0000-0000-00000000abc1',
    runLabel: 'oracle-slice',
    triggeredBy: 'operator@test',
    profileRunId: 'profile-run-1',
    whitespaceRunId: 'ws-run-1',
    status: 'completed',
    analysis: makeAnalysis(),
    errorMessage: null,
    metadata: {},
    createdAt: new Date('2026-04-06T10:00:00.000Z'),
    updatedAt: new Date('2026-04-06T10:01:00.000Z'),
    ...overrides,
  };
}

describe('EigenOracleWhitespaceReaderService', () => {
  it('returns null when oracle run is missing', async () => {
    const service = createEigenOracleWhitespaceReaderService({
      oracleServiceLayer: {
        async getRunById() {
          return null;
        },
      },
    });

    const result = await service.getWhitespaceIntelligenceByRunId('missing-run');
    expect(result).toBeNull();
  });

  it('normalizes completed oracle run for eigen consumption', async () => {
    const service = createEigenOracleWhitespaceReaderService({
      oracleServiceLayer: {
        async getRunById() {
          return makeServiceLayerRun();
        },
      },
    });

    const result = await service.getWhitespaceIntelligenceByRunId('oracle-run-1');

    expect(result).not.toBeNull();
    expect(result!.runId).toBe('oracle-run-1');
    expect(result!.status).toBe('completed');
    expect(result!.generatedAt).toBe('2026-04-06T10:01:00.000Z');
    expect(result!.errorMessage).toBeNull();
    expect(result!.payload).toEqual({
      gapCount: 1,
      predictiveGapCount: 4,
      retrievalQualifiedCount: 1,
      topPredictiveGapScore: 91,
      trend: 'rising',
      opportunityScore: 88,
      topPredictiveGaps: [
        { topicId: 'pricing', predictiveScore: 91, priority: 'critical' },
        { topicId: 'distribution', predictiveScore: 82, priority: 'high' },
        { topicId: 'support', predictiveScore: 68, priority: 'medium' },
      ],
    });
  });

  it('returns running status with null payload', async () => {
    const service = createEigenOracleWhitespaceReaderService({
      oracleServiceLayer: {
        async getRunById() {
          return makeServiceLayerRun({
            status: 'running',
            analysis: null,
            whitespaceRunId: null,
            updatedAt: new Date('2026-04-06T10:01:30.000Z'),
          });
        },
      },
    });

    const result = await service.getWhitespaceIntelligenceByRunId('oracle-run-1');

    expect(result).toEqual({
      runId: 'oracle-run-1',
      status: 'running',
      generatedAt: '2026-04-06T10:01:30.000Z',
      payload: null,
      errorMessage: null,
    });
  });

  it('returns failed result when envelope mapper throws (completed run missing analysis)', async () => {
    const service = createEigenOracleWhitespaceReaderService({
      oracleServiceLayer: {
        async getRunById() {
          return makeServiceLayerRun({
            status: 'completed',
            analysis: null,
            updatedAt: new Date('2026-04-06T10:05:00.000Z'),
          });
        },
      },
    });

    const result = await service.getWhitespaceIntelligenceByRunId('oracle-run-1');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.runId).toBe('oracle-run-1');
    expect(result!.generatedAt).toBe('2026-04-06T10:05:00.000Z');
    expect(result!.payload).toBeNull();
    expect(result!.errorMessage).toBe('Completed service-layer run is missing analysis payload');
  });

  it('returns failed status with propagated error message', async () => {
    const service = createEigenOracleWhitespaceReaderService({
      oracleServiceLayer: {
        async getRunById() {
          return makeServiceLayerRun({
            status: 'failed',
            analysis: null,
            whitespaceRunId: null,
            errorMessage: 'analysis timed out',
            updatedAt: new Date('2026-04-06T10:03:00.000Z'),
          });
        },
      },
    });

    const result = await service.getWhitespaceIntelligenceByRunId('oracle-run-1');

    expect(result).toEqual({
      runId: 'oracle-run-1',
      status: 'failed',
      generatedAt: '2026-04-06T10:03:00.000Z',
      payload: null,
      errorMessage: 'analysis timed out',
    });
  });
});
