import { describe, expect, it, vi } from 'vitest';
import {
  createOracleServiceLayerService,
  type DbOracleServiceLayerRow,
  type OracleServiceLayerDb,
  type OracleServiceLayerDeps,
} from '../../src/services/oracle/oracle-service-layer.service.js';
import type { OracleWhitespaceAnalysis } from '../../src/types/oracle/whitespace-core.js';

function makeMockDb(): OracleServiceLayerDb & { rows: DbOracleServiceLayerRow[] } {
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
    async queryRuns(filter) {
      return rows
        .filter((row) => (filter?.entityAssetId ? row.entity_asset_id === filter.entityAssetId : true))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, filter?.limit ?? 20);
    },
    async updateRun(id, patch) {
      const idx = rows.findIndex((row) => row.id === id);
      if (idx === -1) throw new Error(`run not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

function makeAnalysis(): OracleWhitespaceAnalysis {
  return {
    gaps: [],
    predictiveGaps: [
      {
        topicId: 'pricing',
        gapScore: 80,
        priority: 'critical',
        predictiveScore: 91,
        context: { topicImportance: 90, recencyFactor: 0.2, closureEase: 0.7 },
      },
    ],
    retrievalQualified: [],
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
      freshnessReferenceTime: '2026-04-06T00:00:00.000Z',
    },
    summary: {
      gapCount: 0,
      predictiveGapCount: 1,
      topPredictiveGapScore: 91,
      retrievalQualifiedCount: 0,
      rescoreCandidateCount: 0,
      opportunityScore: 88,
      trend: 'stable',
      addedCount: 0,
      removedCount: 0,
    },
  };
}

function makeDeps(overrides?: Partial<OracleServiceLayerDeps>): OracleServiceLayerDeps {
  const whitespaceCore = {
    analyze: vi.fn().mockReturnValue(makeAnalysis()),
    createRun: vi.fn().mockResolvedValue({ id: 'ws-run-1' }),
  };

  const profileRun = {
    create: vi.fn().mockResolvedValue({ id: 'profile-run-1' }),
    start: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };

  return {
    whitespaceCore,
    profileRun,
    ...overrides,
  };
}

describe('OracleServiceLayerService', () => {
  it('executes whitespace run orchestration and persists completed service-layer run', async () => {
    const db = makeMockDb();
    const deps = makeDeps();
    const service = createOracleServiceLayerService(db, deps);

    const result = await service.executeWhitespaceRun({
      entityAssetId: '00000000-0000-0000-0000-00000000abc1',
      runLabel: 'slice-06-run',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
      metadata: { lane: 'internal' },
    });

    expect(result.status).toBe('completed');
    expect(result.whitespaceRunId).toBe('ws-run-1');
    expect(result.profileRunId).toBe('profile-run-1');
    expect(deps.profileRun.start).toHaveBeenCalledWith('profile-run-1');
    expect(deps.profileRun.complete).toHaveBeenCalledWith(
      'profile-run-1',
      expect.objectContaining({ signalCount: 1, topScore: 91 }),
    );
    expect(deps.profileRun.fail).not.toHaveBeenCalled();
  });

  it('marks service-layer run as failed and fails profile-run when analysis throws', async () => {
    const db = makeMockDb();
    const deps = makeDeps({
      whitespaceCore: {
        analyze: vi.fn().mockImplementation(() => {
          throw new Error('analysis blew up');
        }),
        createRun: vi.fn(),
      },
    });
    const service = createOracleServiceLayerService(db, deps);

    const result = await service.executeWhitespaceRun({
      entityAssetId: '00000000-0000-0000-0000-00000000abc2',
      runLabel: 'slice-06-fail',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
    });

    expect(result.status).toBe('failed');
    expect(result.whitespaceRunId).toBeNull();
    expect(result.analysis).toBeNull();
    expect(result.errorMessage).toContain('analysis blew up');
    expect(deps.profileRun.fail).toHaveBeenCalledWith('profile-run-1');
    expect(deps.profileRun.complete).not.toHaveBeenCalled();
  });

  it('does not call profileRun.complete when db.updateRun rejects after analysis, and records run as failed', async () => {
    // Simulate a DB outage that occurs only when trying to persist 'completed'.
    // This is the scenario where analysis succeeds but persistence fails —
    // the profile-run should NOT be completed, and a 'failed' record must be written.
    let updateCallCount = 0;
    const db: OracleServiceLayerDb & { rows: DbOracleServiceLayerRow[] } = {
      rows: [],
      async insertRun(row) {
        db.rows.push(row);
        return row;
      },
      async findRunById(id) {
        return db.rows.find((r) => r.id === id) ?? null;
      },
      async queryRuns() {
        return db.rows;
      },
      async updateRun(id, patch) {
        updateCallCount++;
        if (patch.status === 'completed') throw new Error('DB constraint error');
        const idx = db.rows.findIndex((r) => r.id === id);
        if (idx === -1) throw new Error(`run not found: ${id}`);
        db.rows[idx] = { ...db.rows[idx], ...patch };
        return db.rows[idx];
      },
    };

    const deps = makeDeps();
    const service = createOracleServiceLayerService(db, deps);

    const result = await service.executeWhitespaceRun({
      entityAssetId: '00000000-0000-0000-0000-00000000abc4',
      runLabel: 'slice-06-update-fail',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('DB constraint error');
    expect(deps.profileRun.complete).not.toHaveBeenCalled();
    expect(deps.profileRun.fail).toHaveBeenCalledWith('profile-run-1');
    // updateRun called twice: once for 'completed' (throws), once for 'failed' (succeeds)
    expect(updateCallCount).toBe(2);
  });



  it('lists recent runs ordered by createdAt desc and filtered by entityAssetId', async () => {
    const db = makeMockDb();
    const deps = makeDeps();
    const service = createOracleServiceLayerService(db, deps);

    await service.executeWhitespaceRun({
      entityAssetId: 'entity-a',
      runLabel: 'older-a',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await service.executeWhitespaceRun({
      entityAssetId: 'entity-b',
      runLabel: 'b-only',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await service.executeWhitespaceRun({
      entityAssetId: 'entity-a',
      runLabel: 'newer-a',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
    });

    const filtered = await service.listRecentRuns({ entityAssetId: 'entity-a', limit: 2 });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((run) => run.runLabel)).toEqual(['newer-a', 'older-a']);
    expect(filtered.every((run) => run.entityAssetId === 'entity-a')).toBe(true);
  });

  it('reads persisted service-layer runs by id', async () => {
    const db = makeMockDb();
    const deps = makeDeps();
    const service = createOracleServiceLayerService(db, deps);

    const created = await service.executeWhitespaceRun({
      entityAssetId: '00000000-0000-0000-0000-00000000abc3',
      runLabel: 'slice-06-read',
      triggeredBy: 'operator@test',
      analysisInput: { coverage: [] },
    });

    const fetched = await service.getRunById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
  });

  it('rejects invalid history limit values', async () => {
    const db = makeMockDb();
    const deps = makeDeps();
    const service = createOracleServiceLayerService(db, deps);

    await expect(service.listRecentRuns({ limit: 0 })).rejects.toThrow(
      /limit must be a positive integer/,
    );
    await expect(service.listRecentRuns({ limit: 101 })).rejects.toThrow(
      /limit must be a positive integer/,
    );
  });
});
