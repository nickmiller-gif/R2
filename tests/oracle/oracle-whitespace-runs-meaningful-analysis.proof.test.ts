import { describe, expect, it, vi } from 'vitest';
import {
  createOracleWhitespaceCoreService,
  type DbOracleWhitespaceCoreRow,
  type OracleWhitespaceCoreDb,
} from '../../src/services/oracle/oracle-whitespace-core.service.js';
import {
  createOracleServiceLayerService,
  type DbOracleServiceLayerRow,
  type OracleServiceLayerDb,
} from '../../src/services/oracle/oracle-service-layer.service.js';
import { toOracleServiceLayerResultEnvelope } from '../../src/services/oracle/oracle-service-layer-api.service.js';
import type { OracleServiceLayerRun } from '../../src/types/oracle/service-layer.js';

function makeWhitespaceDb(): OracleWhitespaceCoreDb & { rows: DbOracleWhitespaceCoreRow[] } {
  const rows: DbOracleWhitespaceCoreRow[] = [];
  return {
    rows,
    async insertRun(row) {
      rows.push(row);
      return row;
    },
    async findRunById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
  };
}

function makeServiceLayerDb(): OracleServiceLayerDb & { rows: DbOracleServiceLayerRow[] } {
  const rows: DbOracleServiceLayerRow[] = [];
  return {
    rows,
    async insertRun(row) {
      rows.push(row);
      return row;
    },
    async findRunById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async updateRun(id, patch) {
      const idx = rows.findIndex((row) => row.id === id);
      if (idx === -1) throw new Error(`service-layer run not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('oracle-whitespace-runs meaningful-analysis proof', () => {
  it('proves non-trivial analysis input produces meaningful whitespace intelligence and summary contract behavior', async () => {
    const whitespaceDb = makeWhitespaceDb();
    const whitespaceCore = createOracleWhitespaceCoreService(whitespaceDb);
    const serviceLayerDb = makeServiceLayerDb();

    const profileRun = {
      create: vi.fn().mockResolvedValue({ id: 'profile-run-meaningful-1' }),
      start: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    const serviceLayer = createOracleServiceLayerService(serviceLayerDb, {
      whitespaceCore,
      profileRun,
    });

    const created = await serviceLayer.executeWhitespaceRun({
      entityAssetId: '00000000-0000-0000-0000-00000000d001',
      runLabel: 'oracle-meaningful-analysis-proof',
      triggeredBy: 'operator-proof-user',
      metadata: { proofSlice: 'oracle-meaningful-analysis' },
      analysisInput: {
        coverage: [
          { topicId: 'pricing-power', coverageScore: 18, evidenceCount: 1 },
          { topicId: 'distribution-moat', coverageScore: 64, evidenceCount: 4 },
          { topicId: 'regulatory-risk', coverageScore: 82, evidenceCount: 8 },
        ],
        gapContextsByTopicId: {
          'pricing-power': { topicImportance: 96, recencyFactor: 0.15, closureEase: 0.72 },
          'distribution-moat': { topicImportance: 88, recencyFactor: 0.25, closureEase: 0.61 },
        },
        retrievalResults: [
          {
            id: 'filing-10q-2026q1',
            relevance: 0.91,
            sourceLane: 'external_authoritative',
            excerpt: 'Revenue concentration increased in the latest quarter.',
            metadata: { source: 'sec' },
          },
          {
            id: 'expert-interview-0426',
            relevance: 0.76,
            sourceLane: 'external_perspective',
            excerpt: 'Channel conflict is reducing conversion efficiency.',
            metadata: { source: 'interview' },
          },
          {
            id: 'low-signal-blog',
            relevance: 0.22,
            sourceLane: 'external_perspective',
            excerpt: 'Speculative commentary with weak citations.',
            metadata: { source: 'blog' },
          },
        ],
        retrievalMinRelevance: 0.65,
        evidenceAges: [
          { id: 'ev-stale-1', createdAt: new Date('2025-08-01T00:00:00.000Z') },
          { id: 'ev-stale-2', createdAt: new Date('2025-10-15T00:00:00.000Z') },
          { id: 'ev-fresh-1', createdAt: new Date('2026-04-03T00:00:00.000Z') },
        ],
        freshnessReferenceTime: new Date('2026-04-06T00:00:00.000Z'),
        verificationEvidence: [
          { role: 'validation', weight: 0.45 },
          { role: 'validation', weight: 0.32 },
          { role: 'contradiction', weight: 0.23 },
        ],
        opportunitySignals: [
          { score: 92, weight: 0.5, tags: ['underpriced', 'durability'] },
          { score: 74, weight: 0.3, tags: ['timing-window'] },
          { score: 64, weight: 0.2, tags: ['execution-risk'] },
        ],
        opportunityDaysToAction: 9,
        scoreSnapshots: [
          { recordedAt: new Date('2026-03-28T00:00:00.000Z'), score: 58 },
          { recordedAt: new Date('2026-04-02T00:00:00.000Z'), score: 69 },
          { recordedAt: new Date('2026-04-06T00:00:00.000Z'), score: 83 },
        ],
        previousRunEntries: [
          { id: 'thesis-pricing', score: 51, status: 'active' },
          { id: 'thesis-geo-expansion', score: 62, status: 'active' },
        ],
        currentRunEntries: [
          { id: 'thesis-pricing', score: 79, status: 'active' },
          { id: 'thesis-regulatory', score: 67, status: 'active' },
        ],
      },
    });

    expect(created.status).toBe('completed');

    const postEnvelope = toOracleServiceLayerResultEnvelope(created);
    expect(postEnvelope.status).toBe('completed');

    if (postEnvelope.status !== 'completed') {
      throw new Error('expected completed envelope status for meaningful-analysis proof');
    }

    expect(postEnvelope.analysis.predictiveGaps.length).toBeGreaterThan(0);
    expect(postEnvelope.analysis.predictiveGaps.map((gap) => gap.topicId)).toContain('pricing-power');
    expect(postEnvelope.analysis.summary.predictiveGapCount).toBeGreaterThan(0);

    expect(postEnvelope.analysis.retrievalQualified.map((item) => item.id)).toEqual([
      'filing-10q-2026q1',
      'expert-interview-0426',
    ]);

    expect(postEnvelope.analysis.temporalSignals.trend).toBe('rising');
    expect(postEnvelope.analysis.temporalSignals.staleEvidenceCount).toBeGreaterThan(0);

    expect(postEnvelope.analysis.reasoning.contradictionRatio).toBeGreaterThan(0);
    expect(postEnvelope.analysis.reasoning.contradictionRatio).toBeLessThan(0.5);
    expect(postEnvelope.analysis.contradictionSeverity).toBe('minor');

    expect(postEnvelope.analysis.opportunity.score).toBeGreaterThan(70);
    const dominantOpportunityTiming = postEnvelope.analysis.opportunityTiming.reduce(
      (best, timing) => (timing.weightedScore > best.weightedScore ? timing : best),
    );
    expect(['immediate', 'near']).toContain(dominantOpportunityTiming.horizon);
    expect(dominantOpportunityTiming.weightedScore).toBeGreaterThan(30);

    // v3 summary rule: result.summary must mirror structured analysis summary.
    expect(postEnvelope.summary).toEqual(postEnvelope.analysis.summary);

    // profile-run completion message belongs in oracle_profile_runs.summary only.
    expect(profileRun.complete).toHaveBeenCalledWith(
      'profile-run-meaningful-1',
      expect.objectContaining({
        summary: "Whitespace run 'oracle-meaningful-analysis-proof' completed",
      }),
    );
    expect(postEnvelope.summary).not.toBe(
      "Whitespace run 'oracle-meaningful-analysis-proof' completed",
    );

    const fetched = await serviceLayer.getRunById(created.id);
    expect(fetched).not.toBeNull();

    const getEnvelope = toOracleServiceLayerResultEnvelope(fetched!);
    expect(getEnvelope.status).toBe('completed');

    if (getEnvelope.status !== 'completed') {
      throw new Error('expected completed envelope from GET path');
    }

    // GET must return the same structured summary value produced at POST-time.
    expect(getEnvelope.summary).toEqual(postEnvelope.summary);
    expect(getEnvelope.analysis.summary).toEqual(postEnvelope.analysis.summary);

    // v3 safety: completed analysis missing structured summary is treated as corrupt — must throw.
    const withoutStructuredSummary = {
      ...fetched!,
      analysis: {
        ...fetched!.analysis!,
        summary: undefined,
      },
    } as unknown as OracleServiceLayerRun;

    expect(() => toOracleServiceLayerResultEnvelope(withoutStructuredSummary)).toThrow(
      /missing summary/,
    );
  });
});
