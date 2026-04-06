import { describe, expect, it } from 'vitest';
import type {
  OracleServiceLayerCompletedResultEnvelope,
  OracleServiceLayerFailedResultEnvelope,
  OracleServiceLayerResultEnvelope,
} from '../../src/types/oracle/service-layer.js';

describe('Oracle service-layer result envelope type', () => {
  it('captures completed and failed Oracle run result contracts', () => {
    const completed: OracleServiceLayerCompletedResultEnvelope = {
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
      analysis: {
        gaps: [{ topicId: 'pricing', gapScore: 60, priority: 'high' }],
        predictiveGaps: [],
        retrievalQualified: [],
        rescoreCandidates: [],
        verification: {
          consistent: true,
          validationWeight: 0.8,
          contradictionWeight: 0.1,
          contradictionRatio: 0.111,
          uncertaintyLevel: 'low',
        },
        contradictionSeverity: 'none',
        opportunity: { score: 77, confidence: 'medium', signalCount: 1 },
        opportunityTiming: [],
        temporalDrift: { totalDrift: 0, driftPerDay: 0, trend: 'rising', windowDays: 7 },
        runDiff: { scoreDeltas: [], added: [], removed: [], statusChanged: [] },
        reasoning: {
          consistent: true,
          contradictionRatio: 0.111,
          uncertaintyLevel: 'low',
          contradictionSeverity: 'none',
          retrievalQualifiedCount: 2,
          rescoreCandidateCount: 1,
        },
        temporalSignals: {
          trend: 'rising',
          driftPerDay: 0,
          windowDays: 7,
          staleEvidenceCount: 0,
          freshnessReferenceTime: '2026-04-06T00:00:00.000Z',
        },
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
      },
      errorMessage: null,
    };

    const failed: OracleServiceLayerFailedResultEnvelope = {
      runId: 'run-2',
      status: 'failed',
      generatedAt: '2026-04-06T00:00:00.000Z',
      summary: null,
      analysis: null,
      errorMessage: 'analysis blew up',
    };

    // discriminated union narrows correctly
    const envelope: OracleServiceLayerResultEnvelope = completed;
    if (envelope.status === 'completed') {
      expect(envelope.summary).not.toBeNull();
      expect(envelope.summary.opportunityScore).toBe(77);
      expect(envelope.analysis.gaps).toHaveLength(1);
    }
    expect(failed.errorMessage).toContain('blew up');
  });
});
