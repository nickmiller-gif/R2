import { describe, expect, it } from 'vitest';
import type {
  OracleWhitespaceAnalysis,
  OracleWhitespaceAnalysisInput,
  OracleWhitespaceAnalysisResultEnvelope,
} from '../../src/types/oracle/whitespace-core.js';

describe('Oracle whitespace domain model types', () => {
  it('supports evidence-aware reasoning, uncertainty, and temporal/drift contracts', () => {
    const input: OracleWhitespaceAnalysisInput = {
      coverage: [{ topicId: 'pricing', coverageScore: 40, evidenceCount: 2 }],
      verificationEvidence: [{ role: 'validation', weight: 0.8 }],
      opportunitySignals: [{ score: 72, weight: 0.6, tags: ['market'] }],
      scoreSnapshots: [{ recordedAt: new Date('2026-04-06T00:00:00.000Z'), score: 72 }],
    };

    const analysis: OracleWhitespaceAnalysis = {
      gaps: [{ topicId: 'pricing', gapScore: 60, priority: 'high' }],
      predictiveGaps: [
        {
          topicId: 'pricing',
          gapScore: 60,
          priority: 'high',
          predictiveScore: 79,
          context: { topicImportance: 90, recencyFactor: 0.2, closureEase: 0.7 },
        },
      ],
      retrievalQualified: [
        {
          id: 'doc-1',
          relevance: 0.91,
          sourceLane: 'external_authoritative',
          excerpt: 'Supportive evidence',
          metadata: { source: 'filing' },
        },
      ],
      rescoreCandidates: [
        {
          id: 'ev-1',
          freshness: { ageDays: 57, freshnessScore: 18, label: 'stale' },
        },
      ],
      verification: {
        consistent: true,
        validationWeight: 0.8,
        contradictionWeight: 0.1,
        contradictionRatio: 0.111,
        uncertaintyLevel: 'low',
      },
      contradictionSeverity: 'none',
      opportunity: { score: 75, confidence: 'medium', signalCount: 1 },
      opportunityTiming: [
        { horizon: 'immediate', weightedScore: 75, proximityFactor: 1 },
        { horizon: 'near', weightedScore: 30, proximityFactor: 0.4 },
      ],
      temporalDrift: { totalDrift: 5, driftPerDay: 0.8, trend: 'rising', windowDays: 6 },
      runDiff: {
        scoreDeltas: [
          {
            id: 'thesis-1',
            previousScore: 65,
            currentScore: 75,
            delta: 10,
            severity: 'significant',
          },
        ],
        added: ['thesis-2'],
        removed: [],
        statusChanged: [],
      },
      reasoning: {
        consistent: true,
        contradictionRatio: 0.111,
        uncertaintyLevel: 'low',
        contradictionSeverity: 'none',
        retrievalQualifiedCount: 1,
        rescoreCandidateCount: 1,
      },
      temporalSignals: {
        trend: 'rising',
        driftPerDay: 0.8,
        windowDays: 6,
        staleEvidenceCount: 1,
        freshnessReferenceTime: '2026-04-06T00:00:00.000Z',
      },
      summary: {
        gapCount: 1,
        predictiveGapCount: 1,
        topPredictiveGapScore: 79,
        retrievalQualifiedCount: 1,
        rescoreCandidateCount: 1,
        opportunityScore: 75,
        trend: 'rising',
        addedCount: 1,
        removedCount: 0,
      },
    };

    const envelope: OracleWhitespaceAnalysisResultEnvelope = {
      analysis,
      summary: analysis.summary,
      generatedAt: '2026-04-06T00:00:00.000Z',
    };

    expect(input.coverage).toHaveLength(1);
    expect(envelope.summary.trend).toBe('rising');
    expect(envelope.analysis.rescoreCandidates[0]?.freshness.label).toBe('stale');
  });
});
