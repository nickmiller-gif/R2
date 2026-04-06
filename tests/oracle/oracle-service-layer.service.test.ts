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
});
