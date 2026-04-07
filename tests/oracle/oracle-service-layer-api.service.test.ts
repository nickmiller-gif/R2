import { describe, expect, it } from 'vitest';
import {
  toOracleServiceLayerResultEnvelope,
  toOracleServiceLayerRunHistoryItem,
} from '../../src/services/oracle/oracle-service-layer-api.service.js';
import type {
  OracleServiceLayerRun,
  OracleServiceLayerRunDecision,
  OracleServiceLayerRunSummaryRow,
} from '../../src/types/oracle/service-layer.js';
import type { OracleServiceLayerRunOutcome } from '../../src/types/oracle/run-outcome.js';

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
      expect(envelope.summary.opportunityScore).toBe(42);
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

  it('throws for completed runs with analysis missing summary', () => {
    const run = {
      ...makeBaseRun(),
      status: 'completed' as const,
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
          uncertaintyLevel: 'low' as const,
        },
        contradictionSeverity: 'none' as const,
        opportunity: { score: 42, confidence: 'medium' as const, signalCount: 1 },
        opportunityTiming: [],
        temporalDrift: { trend: 'stable' as const, totalDrift: 0, driftPerDay: 0, windowDays: 0 },
        runDiff: { added: [], removed: [], scoreDeltas: [], statusChanged: [] },
        reasoning: {
          consistent: true,
          contradictionRatio: 0,
          uncertaintyLevel: 'low' as const,
          contradictionSeverity: 'none' as const,
          retrievalQualifiedCount: 0,
          rescoreCandidateCount: 0,
        },
        temporalSignals: {
          trend: 'stable' as const,
          driftPerDay: 0,
          windowDays: 0,
          staleEvidenceCount: 0,
          freshnessReferenceTime: '2026-04-06T01:00:00.000Z',
        },
        // summary intentionally omitted to simulate legacy/corrupt payload
        summary: undefined as unknown as ReturnType<typeof Object>,
      },
    };

    expect(() => toOracleServiceLayerResultEnvelope(run as OracleServiceLayerRun)).toThrow(
      /missing summary/,
    );
  });
});

describe('toOracleServiceLayerRunHistoryItem', () => {
  it('maps run summary row with decision and outcome for history payload', () => {
    const run: OracleServiceLayerRunSummaryRow = {
      id: 'run-hist-1',
      status: 'completed',
      entityAssetId: 'asset-777',
      runLabel: 'history-a',
      createdAt: new Date('2026-04-06T01:00:00.000Z'),
      updatedAt: new Date('2026-04-06T01:10:00.000Z'),
      summary: {
        gapCount: 1,
        predictiveGapCount: 1,
        topPredictiveGapScore: 90,
        retrievalQualifiedCount: 1,
        rescoreCandidateCount: 0,
        opportunityScore: 77,
        trend: 'stable',
        addedCount: 0,
        removedCount: 0,
      },
    };
    const operatorDecision: OracleServiceLayerRunDecision = {
      id: 'decision-1',
      oracleServiceLayerRunId: run.id,
      decisionStatus: 'pursue',
      notes: 'highest value lane',
      decidedBy: 'operator-1',
      decidedAt: new Date('2026-04-06T01:12:00.000Z'),
      createdAt: new Date('2026-04-06T01:12:00.000Z'),
      updatedAt: new Date('2026-04-06T01:12:00.000Z'),
    };
    const runOutcome: OracleServiceLayerRunOutcome = {
      id: 'outcome-1',
      oracleServiceLayerRunId: run.id,
      outcomeStatus: 'won',
      outcomeNotes: 'converted to closed-won expansion',
      outcomeRevenue: 120000,
      outcomeClosedAt: new Date('2026-04-06T03:00:00.000Z'),
      recordedBy: 'operator-1',
      createdAt: new Date('2026-04-06T03:00:00.000Z'),
      updatedAt: new Date('2026-04-06T03:00:00.000Z'),
    };

    const historyItem = toOracleServiceLayerRunHistoryItem({ run, operatorDecision, runOutcome });

    expect(historyItem).toEqual({
      id: run.id,
      status: run.status,
      entityAssetId: run.entityAssetId,
      runLabel: run.runLabel,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      summary: run.summary,
      operatorDecision,
      runOutcome,
    });
  });
});
