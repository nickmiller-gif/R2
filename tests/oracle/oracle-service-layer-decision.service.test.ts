import { describe, expect, it } from 'vitest';
import {
  createOracleServiceLayerRunDecisionService,
  type DbOracleServiceLayerRunDecisionRow,
  type OracleServiceLayerRunDecisionDb,
} from '../../src/services/oracle/oracle-service-layer-decision.service.js';

function makeMockDb(): OracleServiceLayerRunDecisionDb & { rows: DbOracleServiceLayerRunDecisionRow[] } {
  const rows: DbOracleServiceLayerRunDecisionRow[] = [];
  return {
    rows,
    async upsertDecision(row) {
      const existingIdx = rows.findIndex(
        (candidate) => candidate.oracle_service_layer_run_id === row.oracle_service_layer_run_id,
      );
      if (existingIdx >= 0) {
        // Replace the whole row (service already populated stable id/created_at from the read-first lookup)
        rows[existingIdx] = row;
        return row;
      }
      rows.push(row);
      return row;
    },
    async findDecisionByRunId(oracleServiceLayerRunId) {
      return rows.find((row) => row.oracle_service_layer_run_id === oracleServiceLayerRunId) ?? null;
    },
    async findDecisionsByRunIds(runIds) {
      return rows.filter((row) => runIds.includes(row.oracle_service_layer_run_id));
    },
  };
}

describe('OracleServiceLayerRunDecisionService', () => {
  it('persists a decision and reads it back by run id', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunDecisionService(db);

    const created = await service.upsertDecision({
      oracleServiceLayerRunId: '00000000-0000-0000-0000-00000000d001',
      decisionStatus: 'pursue',
      notes: 'meets confidence threshold',
      decidedBy: 'operator@test',
    });

    expect(created.oracleServiceLayerRunId).toBe('00000000-0000-0000-0000-00000000d001');
    expect(created.decisionStatus).toBe('pursue');
    expect(created.notes).toContain('confidence');
    expect(created.decidedBy).toBe('operator@test');

    const fetched = await service.getDecisionByRunId('00000000-0000-0000-0000-00000000d001');
    expect(fetched).not.toBeNull();
    expect(fetched?.decisionStatus).toBe('pursue');
  });

  it('upserts the existing run decision instead of creating a second record', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunDecisionService(db);
    const runId = '00000000-0000-0000-0000-00000000d002';

    const first = await service.upsertDecision({
      oracleServiceLayerRunId: runId,
      decisionStatus: 'defer',
      decidedBy: 'operator@test',
    });

    const updated = await service.upsertDecision({
      oracleServiceLayerRunId: runId,
      decisionStatus: 'dismiss',
      notes: 'no longer relevant',
      decidedBy: 'operator-2@test',
    });

    expect(updated.decisionStatus).toBe('dismiss');
    expect(updated.notes).toBe('no longer relevant');
    expect(updated.decidedBy).toBe('operator-2@test');
    expect(db.rows).toHaveLength(1);

    // Immutable fields must be preserved across updates
    expect(updated.id).toBe(first.id);
    expect(updated.createdAt.toISOString()).toBe(first.createdAt.toISOString());
  });

  it('returns an empty map when no run ids are provided', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunDecisionService(db);

    const result = await service.getDecisionsByRunIds([]);
    expect(result.size).toBe(0);
  });

  it('returns decisions mapped by run id for batch lookup', async () => {
    const db = makeMockDb();
    const service = createOracleServiceLayerRunDecisionService(db);

    await service.upsertDecision({
      oracleServiceLayerRunId: '00000000-0000-0000-0000-00000000d101',
      decisionStatus: 'pursue',
      decidedBy: 'operator-a@test',
    });
    await service.upsertDecision({
      oracleServiceLayerRunId: '00000000-0000-0000-0000-00000000d102',
      decisionStatus: 'defer',
      decidedBy: 'operator-b@test',
    });

    const result = await service.getDecisionsByRunIds([
      '00000000-0000-0000-0000-00000000d101',
      '00000000-0000-0000-0000-00000000d102',
    ]);

    expect(result.size).toBe(2);
    expect(result.get('00000000-0000-0000-0000-00000000d101')?.decisionStatus).toBe('pursue');
    expect(result.get('00000000-0000-0000-0000-00000000d102')?.decisionStatus).toBe('defer');
  });
});
