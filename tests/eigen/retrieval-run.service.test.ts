/**
 * Tests for the Eigen retrieval run service.
 */
import { describe, it, expect } from 'vitest';
import {
  createRetrievalRunService,
  type RetrievalRunDb,
  type DbRetrievalRunRow,
} from '../../src/services/eigen/retrieval-run.service.js';
import type { RetrievalRunFilter } from '../../src/types/eigen/retrieval-run.js';

function makeMockDb(): RetrievalRunDb & { rows: DbRetrievalRunRow[] } {
  const rows: DbRetrievalRunRow[] = [];
  return {
    rows,
    async insertRun(row) {
      rows.push(row);
      return row;
    },
    async findRunById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryRuns(filter?: RetrievalRunFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateRun(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Run not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('RetrievalRunService', () => {
  it('creates run with pending status and zero counts', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const run = await service.create({
      queryHash: 'hash-abc-123',
    });

    expect(run.queryHash).toBe('hash-abc-123');
    expect(run.status).toBe('pending');
    expect(run.candidateCount).toBe(0);
    expect(run.filteredCount).toBe(0);
    expect(run.finalCount).toBe(0);
    expect(run.latencyMs).toBe(0);
    expect(run.decomposition).toEqual({});
    expect(run.budgetProfile).toEqual({});
    expect(run.droppedContextReasons).toEqual([]);
    expect(run.metadata).toEqual({});
  });

  it('creates run with decomposition and budget', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const run = await service.create({
      queryHash: 'hash-xyz',
      decomposition: { steps: ['vector', 'filter', 'rerank'] },
      budgetProfile: { maxTokens: 4096, maxChunks: 20 },
    });

    expect(run.decomposition).toEqual({ steps: ['vector', 'filter', 'rerank'] });
    expect(run.budgetProfile).toEqual({ maxTokens: 4096, maxChunks: 20 });
  });

  it('returns null for nonexistent run', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('completes a run with results', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const run = await service.create({ queryHash: 'hash-1' });
    expect(run.status).toBe('pending');

    const completed = await service.complete(run.id, {
      candidateCount: 100,
      filteredCount: 30,
      finalCount: 10,
      latencyMs: 245,
    });

    expect(completed.status).toBe('completed');
    expect(completed.candidateCount).toBe(100);
    expect(completed.filteredCount).toBe(30);
    expect(completed.finalCount).toBe(10);
    expect(completed.latencyMs).toBe(245);
  });

  it('fails a run with reason', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const run = await service.create({ queryHash: 'hash-2' });

    const failed = await service.fail(run.id, 'Vector store timeout');

    expect(failed.status).toBe('failed');
    expect(failed.metadata).toEqual({ failureReason: 'Vector store timeout' });
  });

  it('lists runs filtered by status', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const run1 = await service.create({ queryHash: 'h1' });
    const run2 = await service.create({ queryHash: 'h2' });
    await service.create({ queryHash: 'h3' });

    await service.complete(run1.id, {
      candidateCount: 50, filteredCount: 20, finalCount: 5, latencyMs: 100,
    });
    await service.fail(run2.id, 'Error');

    const pending = await service.list({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].queryHash).toBe('h3');

    const completed = await service.list({ status: 'completed' });
    expect(completed).toHaveLength(1);
    expect(completed[0].queryHash).toBe('h1');

    const failed = await service.list({ status: 'failed' });
    expect(failed).toHaveLength(1);
    expect(failed[0].queryHash).toBe('h2');
  });

  it('lists all runs when no filter provided', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    await service.create({ queryHash: 'a' });
    await service.create({ queryHash: 'b' });
    await service.create({ queryHash: 'c' });

    const all = await service.list();
    expect(all).toHaveLength(3);
  });

  it('retrieves run by id with all fields', async () => {
    const db = makeMockDb();
    const service = createRetrievalRunService(db);

    const run = await service.create({
      queryHash: 'full-hash',
      decomposition: { strategy: 'multi_hop' },
      budgetProfile: { limit: 500 },
    });

    const retrieved = await service.getById(run.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(run.id);
    expect(retrieved!.queryHash).toBe('full-hash');
    expect(retrieved!.decomposition).toEqual({ strategy: 'multi_hop' });
    expect(retrieved!.budgetProfile).toEqual({ limit: 500 });
    expect(retrieved!.createdAt).toBeInstanceOf(Date);
  });
});
