/**
 * Tests for the Oracle profile-run service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOracleProfileRunService,
  type OracleProfileRunDb,
  type DbOracleProfileRunRow,
} from '../../src/services/oracle/oracle-profile-run.service.js';
import type { OracleProfileRunFilter } from '../../src/types/oracle/profile-run.js';
import {
  makeCreateOracleProfileRunInput,
  resetFixtureCounter,
} from '../foundation/fixtures/foundation-fixtures.js';

function makeMockDb(): OracleProfileRunDb & { rows: DbOracleProfileRunRow[] } {
  const rows: DbOracleProfileRunRow[] = [];
  return {
    rows,
    async insertRun(row) {
      rows.push(row);
      return row;
    },
    async findRunById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findLatestForEntity(entityAssetId) {
      const matching = rows
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => r.entity_asset_id === entityAssetId)
        // Simulate ORDER BY created_at DESC; use insertion index as tiebreaker
        .sort((a, b) =>
          b.r.created_at.localeCompare(a.r.created_at) || b.idx - a.idx,
        );
      return matching[0]?.r ?? null;
    },
    async queryRuns(filter?: OracleProfileRunFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.entityAssetId && r.entity_asset_id !== filter.entityAssetId) return false;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.triggeredBy && r.triggered_by !== filter.triggeredBy) return false;
        return true;
      });
    },
    async updateRun(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`OracleProfileRun not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('OracleProfileRunService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates a run with queued status and zero counts', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const run = await service.create(makeCreateOracleProfileRunInput());

    expect(run.status).toBe('queued');
    expect(run.signalCount).toBe(0);
    expect(run.topScore).toBeNull();
    expect(run.summary).toBeNull();
    expect(run.startedAt).toBeNull();
    expect(run.completedAt).toBeNull();
    expect(run.triggeredBy).toBe('oracle-scheduler-v1');
  });

  it('returns null for a nonexistent run', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves the latest run for an entity', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);
    const entityId = '00000000-0000-0000-0000-000000000099';

    await service.create(makeCreateOracleProfileRunInput({ entityAssetId: entityId }));
    const second = await service.create(
      makeCreateOracleProfileRunInput({ entityAssetId: entityId, triggeredBy: 'manual' }),
    );

    const latest = await service.getLatestForEntity(entityId);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(second.id);
    expect(latest!.triggeredBy).toBe('manual');
  });

  it('returns null from getLatestForEntity when no runs exist', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const result = await service.getLatestForEntity('no-entity');
    expect(result).toBeNull();
  });

  it('transitions queued → running on start()', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const run = await service.create(makeCreateOracleProfileRunInput());
    const started = await service.start(run.id);

    expect(started.status).toBe('running');
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(started.completedAt).toBeNull();
  });

  it('transitions running → completed on complete() with stats', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const run = await service.create(makeCreateOracleProfileRunInput());
    await service.start(run.id);
    const completed = await service.complete(run.id, {
      signalCount: 12,
      topScore: 88,
      summary: 'Strong opportunity detected across 12 signals.',
    });

    expect(completed.status).toBe('completed');
    expect(completed.signalCount).toBe(12);
    expect(completed.topScore).toBe(88);
    expect(completed.summary).toBe('Strong opportunity detected across 12 signals.');
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  it('transitions running → failed on fail()', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const run = await service.create(makeCreateOracleProfileRunInput());
    await service.start(run.id);
    const failed = await service.fail(run.id);

    expect(failed.status).toBe('failed');
    expect(failed.completedAt).toBeInstanceOf(Date);
  });

  it('transitions queued → canceled on cancel()', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const run = await service.create(makeCreateOracleProfileRunInput());
    const canceled = await service.cancel(run.id);

    expect(canceled.status).toBe('canceled');
    expect(canceled.completedAt).toBeInstanceOf(Date);
  });

  it('filters runs by entityAssetId', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);
    const entityA = '00000000-0000-0000-0000-000000000010';
    const entityB = '00000000-0000-0000-0000-000000000020';

    await service.create(makeCreateOracleProfileRunInput({ entityAssetId: entityA }));
    await service.create(makeCreateOracleProfileRunInput({ entityAssetId: entityA }));
    await service.create(makeCreateOracleProfileRunInput({ entityAssetId: entityB }));

    const runsForA = await service.list({ entityAssetId: entityA });
    expect(runsForA).toHaveLength(2);
    expect(runsForA.every((r) => r.entityAssetId === entityA)).toBe(true);
  });

  it('filters runs by status', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const r1 = await service.create(makeCreateOracleProfileRunInput());
    await service.start(r1.id);
    await service.complete(r1.id, { signalCount: 5, topScore: 72 });

    const r2 = await service.create(makeCreateOracleProfileRunInput());
    await service.start(r2.id);
    await service.fail(r2.id);

    const r3 = await service.create(makeCreateOracleProfileRunInput());

    const completed = await service.list({ status: 'completed' });
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe(r1.id);

    const queued = await service.list({ status: 'queued' });
    expect(queued).toHaveLength(1);
    expect(queued[0].id).toBe(r3.id);
  });

  it('stores and deserializes metadata', async () => {
    const db = makeMockDb();
    const service = createOracleProfileRunService(db);

    const run = await service.create(
      makeCreateOracleProfileRunInput({ metadata: { source: 'cron', priority: 2 } }),
    );

    expect(run.metadata).toEqual({ source: 'cron', priority: 2 });
  });
});
