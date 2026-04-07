import { describe, expect, it } from 'vitest';
import {
  createOracleServiceLayerRunOutcomeService,
  type DbOracleServiceLayerRunOutcomeRow,
  type OracleServiceLayerRunOutcomeDb,
} from '../../src/services/oracle/oracle-service-layer-run-outcome.service.js';
import type { OracleServiceLayerRunOutcomeFilter } from '../../src/types/oracle/run-outcome.js';

function makeMockDb(): OracleServiceLayerRunOutcomeDb & {
  rows: DbOracleServiceLayerRunOutcomeRow[];
} {
  const rows: DbOracleServiceLayerRunOutcomeRow[] = [];
  return {
    rows,
    async upsertOutcome(row) {
      const existingIdx = rows.findIndex(
        (r) => r.oracle_service_layer_run_id === row.oracle_service_layer_run_id,
      );
      if (existingIdx >= 0) {
        rows[existingIdx] = row;
        return row;
      }
      rows.push(row);
      return row;
    },
    async findOutcomeByRunId(oracleServiceLayerRunId) {
      return rows.find((r) => r.oracle_service_layer_run_id === oracleServiceLayerRunId) ?? null;
    },
    async findOutcomeById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findOutcomesByRunIds(runIds) {
      return rows.filter((r) => runIds.includes(r.oracle_service_layer_run_id));
    },
    async queryOutcomes(filter?: OracleServiceLayerRunOutcomeFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (
          filter.oracleServiceLayerRunId &&
          r.oracle_service_layer_run_id !== filter.oracleServiceLayerRunId
        )
          return false;
        if (filter.outcomeStatus && r.outcome_status !== filter.outcomeStatus) return false;
        if (filter.recordedBy && r.recorded_by !== filter.recordedBy) return false;
        return true;
      });
    },
    async updateOutcome(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Outcome not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

const RUN_ID_1 = '00000000-0000-0000-0000-000000000101';
const RUN_ID_2 = '00000000-0000-0000-0000-000000000102';
const RUN_ID_3 = '00000000-0000-0000-0000-000000000103';

describe('OracleServiceLayerRunOutcomeService', () => {
  it('creates an outcome with required fields and null optionals', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const outcome = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'pursued',
      recordedBy: 'operator@test',
    });

    expect(outcome.oracleServiceLayerRunId).toBe(RUN_ID_1);
    expect(outcome.outcomeStatus).toBe('pursued');
    expect(outcome.recordedBy).toBe('operator@test');
    expect(outcome.outcomeNotes).toBeNull();
    expect(outcome.outcomeRevenue).toBeNull();
    expect(outcome.outcomeClosedAt).toBeNull();
    expect(outcome.createdAt).toBeInstanceOf(Date);
    expect(outcome.updatedAt).toBeInstanceOf(Date);
  });

  it('creates an outcome with all optional fields set', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const closedAt = '2026-06-01T00:00:00.000Z';
    const outcome = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'won',
      outcomeNotes: 'Closed enterprise deal.',
      outcomeRevenue: 48000,
      outcomeClosedAt: closedAt,
      recordedBy: 'operator@test',
    });

    expect(outcome.outcomeStatus).toBe('won');
    expect(outcome.outcomeNotes).toBe('Closed enterprise deal.');
    expect(outcome.outcomeRevenue).toBe(48000);
    expect(outcome.outcomeClosedAt).toBeInstanceOf(Date);
    expect(outcome.outcomeClosedAt!.toISOString()).toBe(closedAt);
  });

  it('upserts the existing outcome instead of creating a second record', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const first = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'pursued',
      recordedBy: 'operator@test',
    });

    const updated = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'won',
      outcomeRevenue: 25000,
      outcomeNotes: 'Upgraded to full contract.',
      recordedBy: 'operator@test',
    });

    expect(updated.outcomeStatus).toBe('won');
    expect(updated.outcomeRevenue).toBe(25000);
    expect(db.rows).toHaveLength(1);

    // Immutable fields preserved
    expect(updated.id).toBe(first.id);
    expect(updated.createdAt.toISOString()).toBe(first.createdAt.toISOString());
  });

  it('returns null for a run with no outcome', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const result = await service.getOutcomeByRunId('nonexistent-run-id');
    expect(result).toBeNull();
  });

  it('retrieves outcome by run id', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'dismissed',
      recordedBy: 'operator@test',
    });

    const fetched = await service.getOutcomeByRunId(RUN_ID_1);
    expect(fetched).not.toBeNull();
    expect(fetched!.outcomeStatus).toBe('dismissed');
    expect(fetched!.oracleServiceLayerRunId).toBe(RUN_ID_1);
  });

  it('updates outcome fields via updateOutcome', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const created = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'pursued',
      recordedBy: 'operator@test',
    });

    const updated = await service.updateOutcome(created.id, {
      outcomeStatus: 'lost',
      outcomeNotes: 'Competitor won the deal.',
      outcomeRevenue: 0,
      outcomeClosedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(updated.outcomeStatus).toBe('lost');
    expect(updated.outcomeNotes).toBe('Competitor won the deal.');
    expect(updated.outcomeRevenue).toBe(0);
    expect(updated.outcomeClosedAt).toBeInstanceOf(Date);
  });

  it('can null out optional fields via updateOutcome', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const created = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'won',
      outcomeRevenue: 5000,
      outcomeNotes: 'Initial note.',
      recordedBy: 'operator@test',
    });

    const updated = await service.updateOutcome(created.id, {
      outcomeRevenue: null,
      outcomeNotes: null,
    });

    expect(updated.outcomeRevenue).toBeNull();
    expect(updated.outcomeNotes).toBeNull();
  });

  it('lists all outcomes when no filter provided', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_1, outcomeStatus: 'won', recordedBy: 'op1' });
    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_2, outcomeStatus: 'lost', recordedBy: 'op2' });

    const all = await service.listOutcomes();
    expect(all).toHaveLength(2);
  });

  it('filters list by outcomeStatus', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_1, outcomeStatus: 'won', recordedBy: 'op' });
    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_2, outcomeStatus: 'lost', recordedBy: 'op' });
    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_3, outcomeStatus: 'won', recordedBy: 'op' });

    const wonOutcomes = await service.listOutcomes({ outcomeStatus: 'won' });
    expect(wonOutcomes).toHaveLength(2);
    expect(wonOutcomes.every((o) => o.outcomeStatus === 'won')).toBe(true);
  });

  it('filters list by recordedBy', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_1, outcomeStatus: 'won', recordedBy: 'alice@test' });
    await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_2, outcomeStatus: 'lost', recordedBy: 'bob@test' });

    const aliceOutcomes = await service.listOutcomes({ recordedBy: 'alice@test' });
    expect(aliceOutcomes).toHaveLength(1);
    expect(aliceOutcomes[0].recordedBy).toBe('alice@test');
  });

  it('assigns a unique id to each outcome', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    const o1 = await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_1, outcomeStatus: 'won', recordedBy: 'op' });
    const o2 = await service.upsertOutcome({ oracleServiceLayerRunId: RUN_ID_2, outcomeStatus: 'lost', recordedBy: 'op' });

    expect(o1.id).not.toBe(o2.id);
  });

  it('rejects negative outcomeRevenue on upsert', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    await expect(
      service.upsertOutcome({
        oracleServiceLayerRunId: RUN_ID_1,
        outcomeStatus: 'won',
        outcomeRevenue: -1,
        recordedBy: 'operator@test',
      }),
    ).rejects.toThrow('Outcome revenue cannot be negative.');
  });

  it('rejects invalid outcomeClosedAt on upsert', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);

    await expect(
      service.upsertOutcome({
        oracleServiceLayerRunId: RUN_ID_1,
        outcomeStatus: 'pursued',
        outcomeClosedAt: 'invalid-date',
        recordedBy: 'operator@test',
      }),
    ).rejects.toThrow('Outcome closed timestamp must be a valid ISO-8601 datetime.');
  });

  it('rejects invalid outcomeClosedAt on update', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunOutcomeService(db);
    const created = await service.upsertOutcome({
      oracleServiceLayerRunId: RUN_ID_1,
      outcomeStatus: 'pursued',
      recordedBy: 'operator@test',
    });

    await expect(
      service.updateOutcome(created.id, {
        outcomeClosedAt: 'not-a-date',
      }),
    ).rejects.toThrow('Outcome closed timestamp must be a valid ISO-8601 datetime.');
  });
});
