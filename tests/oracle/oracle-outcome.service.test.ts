/**
 * Tests for the Oracle outcome service.
 */
import { describe, it, expect } from 'vitest';
import {
  createOracleOutcomeService,
  type OracleOutcomeDb,
  type DbOracleOutcomeRow,
} from '../../src/services/oracle/oracle-outcome.service.js';
import type { OracleOutcomeFilter } from '../../src/types/oracle/outcome.js';

function makeMockDb(): OracleOutcomeDb & { rows: DbOracleOutcomeRow[] } {
  const rows: DbOracleOutcomeRow[] = [];
  return {
    rows,
    async insertOutcome(row) {
      rows.push(row);
      return row;
    },
    async findOutcomeById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryOutcomes(filter?: OracleOutcomeFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.thesisId && r.thesis_id !== filter.thesisId) return false;
        if (filter.profileId && r.profile_id !== filter.profileId) return false;
        if (filter.verdict && r.verdict !== filter.verdict) return false;
        if (filter.outcomeSource && r.outcome_source !== filter.outcomeSource) return false;
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

describe('OracleOutcomeService', () => {
  it('creates outcome with default source and empty evidence refs', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const outcome = await service.create({
      thesisId: 'thesis-1',
      verdict: 'confirmed',
      summary: 'The thesis was confirmed by market data.',
    });

    expect(outcome.thesisId).toBe('thesis-1');
    expect(outcome.verdict).toBe('confirmed');
    expect(outcome.summary).toBe('The thesis was confirmed by market data.');
    expect(outcome.outcomeSource).toBe('manual');
    expect(outcome.evidenceRefs).toEqual([]);
    expect(outcome.accuracyScore).toBeNull();
    expect(outcome.confidenceDelta).toBeNull();
    expect(outcome.profileId).toBeNull();
    expect(outcome.metadata).toEqual({});
    expect(outcome.createdAt).toBeInstanceOf(Date);
    expect(outcome.updatedAt).toBeInstanceOf(Date);
  });

  it('creates outcome with all optional fields set', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const outcome = await service.create({
      thesisId: 'thesis-2',
      profileId: 'profile-99',
      verdict: 'partially_confirmed',
      outcomeSource: 'automated',
      summary: 'Partial confirmation based on automated analysis.',
      evidenceRefs: ['evidence-a', 'evidence-b'],
      accuracyScore: 72,
      confidenceDelta: 5,
      metadata: { source: 'pipeline-v2' },
    });

    expect(outcome.profileId).toBe('profile-99');
    expect(outcome.outcomeSource).toBe('automated');
    expect(outcome.evidenceRefs).toEqual(['evidence-a', 'evidence-b']);
    expect(outcome.accuracyScore).toBe(72);
    expect(outcome.confidenceDelta).toBe(5);
    expect(outcome.metadata).toEqual({ source: 'pipeline-v2' });
  });

  it('returns null for nonexistent outcome', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves outcome by id with all fields', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const created = await service.create({
      thesisId: 'thesis-3',
      verdict: 'refuted',
      summary: 'Data contradicts thesis.',
      accuracyScore: 10,
    });

    const retrieved = await service.getById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.verdict).toBe('refuted');
    expect(retrieved!.accuracyScore).toBe(10);
  });

  it('lists all outcomes when no filter provided', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    await service.create({ thesisId: 'thesis-1', verdict: 'confirmed', summary: 'A' });
    await service.create({ thesisId: 'thesis-2', verdict: 'refuted', summary: 'B' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('lists outcomes filtered by thesisId', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    await service.create({ thesisId: 'thesis-A', verdict: 'confirmed', summary: 'A1' });
    await service.create({ thesisId: 'thesis-A', verdict: 'inconclusive', summary: 'A2' });
    await service.create({ thesisId: 'thesis-B', verdict: 'refuted', summary: 'B1' });

    const thesisAOutcomes = await service.list({ thesisId: 'thesis-A' });
    expect(thesisAOutcomes).toHaveLength(2);
    expect(thesisAOutcomes.every((o) => o.thesisId === 'thesis-A')).toBe(true);
  });

  it('lists outcomes filtered by verdict', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    await service.create({ thesisId: 'thesis-1', verdict: 'confirmed', summary: 'A' });
    await service.create({ thesisId: 'thesis-2', verdict: 'refuted', summary: 'B' });
    await service.create({ thesisId: 'thesis-3', verdict: 'confirmed', summary: 'C' });

    const confirmed = await service.list({ verdict: 'confirmed' });
    expect(confirmed).toHaveLength(2);
    expect(confirmed.every((o) => o.verdict === 'confirmed')).toBe(true);
  });

  it('updates outcome fields', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const outcome = await service.create({
      thesisId: 'thesis-1',
      verdict: 'pending',
      summary: 'Awaiting confirmation.',
    });

    const updated = await service.update(outcome.id, {
      verdict: 'confirmed',
      summary: 'Confirmed after review.',
      accuracyScore: 88,
      confidenceDelta: 10,
    });

    expect(updated.verdict).toBe('confirmed');
    expect(updated.summary).toBe('Confirmed after review.');
    expect(updated.accuracyScore).toBe(88);
    expect(updated.confidenceDelta).toBe(10);
  });

  it('updates evidence refs and metadata', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const outcome = await service.create({
      thesisId: 'thesis-1',
      verdict: 'inconclusive',
      summary: 'Mixed signals.',
    });

    const updated = await service.update(outcome.id, {
      evidenceRefs: ['ref-1', 'ref-2'],
      metadata: { reviewed: true },
    });

    expect(updated.evidenceRefs).toEqual(['ref-1', 'ref-2']);
    expect(updated.metadata).toEqual({ reviewed: true });
  });

  it('listByThesis returns outcomes for a specific thesis', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    await service.create({ thesisId: 'thesis-X', verdict: 'confirmed', summary: 'X1' });
    await service.create({ thesisId: 'thesis-X', verdict: 'refuted', summary: 'X2' });
    await service.create({ thesisId: 'thesis-Y', verdict: 'confirmed', summary: 'Y1' });

    const xOutcomes = await service.listByThesis('thesis-X');
    expect(xOutcomes).toHaveLength(2);
    expect(xOutcomes.every((o) => o.thesisId === 'thesis-X')).toBe(true);

    const yOutcomes = await service.listByThesis('thesis-Y');
    expect(yOutcomes).toHaveLength(1);
  });

  it('listByThesis returns empty array when no outcomes exist', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const result = await service.listByThesis('nonexistent-thesis');
    expect(result).toEqual([]);
  });

  it('assigns a unique id to each outcome', async () => {
    const db = makeMockDb();
    const service = createOracleOutcomeService(db);

    const o1 = await service.create({ thesisId: 'thesis-1', verdict: 'confirmed', summary: 'A' });
    const o2 = await service.create({ thesisId: 'thesis-1', verdict: 'refuted', summary: 'B' });

    expect(o1.id).not.toBe(o2.id);
  });
});
