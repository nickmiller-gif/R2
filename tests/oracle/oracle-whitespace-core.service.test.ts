/**
 * Tests for Oracle whitespace core service orchestration.
 */
import { describe, expect, it } from 'vitest';
import {
  createOracleWhitespaceCoreService,
  type DbOracleWhitespaceCoreRow,
  type OracleWhitespaceCoreDb,
} from '../../src/services/oracle/oracle-whitespace-core.service.js';
import type { OracleWhitespaceAnalysis } from '../../src/types/oracle/whitespace-core.js';

function makeMockDb(): OracleWhitespaceCoreDb & { rows: DbOracleWhitespaceCoreRow[] } {
  const rows: DbOracleWhitespaceCoreRow[] = [];
  return {
    rows,
    async insertRun(row) {
      rows.push(row);
      return row;
    },
    async findRunById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
  };
}

describe('OracleWhitespaceCoreService', () => {
  it('composes shared whitespace-core analysis outputs', () => {
    const db = makeMockDb();
    const service = createOracleWhitespaceCoreService(db);

    const analysis = service.analyze({
      coverage: [
        { topicId: 'pricing', coverageScore: 20, evidenceCount: 1 },
        { topicId: 'distribution', coverageScore: 90, evidenceCount: 6 },
      ],
      gapContextsByTopicId: {
        pricing: { topicImportance: 95, recencyFactor: 0.1, closureEase: 0.8 },
      },
      retrievalResults: [
        {
          id: 'doc-1',
          relevance: 0.9,
          sourceLane: 'external_authoritative',
          excerpt: 'High relevance excerpt',
          metadata: {},
        },
        {
          id: 'doc-2',
          relevance: 0.2,
          sourceLane: 'external_perspective',
          excerpt: 'Low relevance excerpt',
          metadata: {},
        },
      ],
      retrievalMinRelevance: 0.5,
      evidenceAges: [
        { id: 'e-old', createdAt: new Date('2025-10-01T00:00:00.000Z') },
        { id: 'e-fresh', createdAt: new Date('2026-04-01T00:00:00.000Z') },
      ],
      freshnessReferenceTime: new Date('2026-04-06T00:00:00.000Z'),
      verificationEvidence: [
        { role: 'validation', weight: 0.9 },
        { role: 'contradiction', weight: 0.1 },
      ],
      opportunitySignals: [
        { score: 85, weight: 0.7 },
        { score: 70, weight: 0.3 },
      ],
      opportunityDaysToAction: 3,
      scoreSnapshots: [
        { recordedAt: new Date('2026-04-01T00:00:00.000Z'), score: 60 },
        { recordedAt: new Date('2026-04-06T00:00:00.000Z'), score: 80 },
      ],
      previousRunEntries: [{ id: 'thesis-1', score: 55, status: 'active' }],
      currentRunEntries: [
        { id: 'thesis-1', score: 80, status: 'active' },
        { id: 'thesis-2', score: 65, status: 'active' },
      ],
    });

    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.predictiveGaps[0].topicId).toBe('pricing');
    expect(analysis.retrievalQualified.map((x) => x.id)).toEqual(['doc-1']);
    expect(analysis.rescoreCandidates.map((x) => x.id)).toEqual(['e-old']);
    expect(analysis.verification.consistent).toBe(true);
    expect(analysis.contradictionSeverity).toBe('none');
    expect(analysis.opportunity.signalCount).toBe(2);
    expect(analysis.temporalDrift.trend).toBe('rising');
    expect(analysis.runDiff.added).toEqual(['thesis-2']);
    expect(analysis.runDiff.scoreDeltas[0].severity).toBe('major');
    expect(analysis.reasoning.retrievalQualifiedCount).toBe(1);
    expect(analysis.reasoning.consistent).toBe(true);
    expect(analysis.temporalSignals.staleEvidenceCount).toBe(1);
    expect(analysis.temporalSignals.trend).toBe('rising');
    expect(analysis.summary.topPredictiveGapScore).toBeGreaterThan(0);
  });

  it('creates and reads persisted whitespace-core runs', async () => {
    const db = makeMockDb();
    const service = createOracleWhitespaceCoreService(db);

    const analysis: OracleWhitespaceAnalysis = service.analyze({ coverage: [] });
    const created = await service.createRun({
      entityAssetId: '00000000-0000-0000-0000-000000000101',
      runLabel: 'oracle-slice-05',
      analysis,
    });

    expect(created.entityAssetId).toBe('00000000-0000-0000-0000-000000000101');
    expect(created.runLabel).toBe('oracle-slice-05');
    expect(created.createdAt).toBeInstanceOf(Date);

    const fetched = await service.getRunById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.analysis.opportunity.score).toBe(0);
  });
});
