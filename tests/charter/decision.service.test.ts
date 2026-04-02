/**
 * Tests for the Charter decision service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterDecisionService,
  type CharterDecisionDb,
  type DbCharterDecisionRow,
} from '../../src/services/charter/decision.service.js';
import type { CharterDecisionFilter } from '../../src/types/charter/types.js';
import {
  makeCreateDecisionInput,
  resetFixtureCounter,
} from './fixtures/charter-domain-fixtures.js';

function makeMockDb(): CharterDecisionDb & { rows: DbCharterDecisionRow[] } {
  const rows: DbCharterDecisionRow[] = [];
  return {
    rows,
    async insertDecision(row) {
      rows.push(row);
      return row;
    },
    async findDecisionById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryDecisions(filter?: CharterDecisionFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.linkedTable && r.linked_table !== filter.linkedTable) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateDecision(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Decision not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('CharterDecisionService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates a decision with pending status and confidence 50', async () => {
    const db = makeMockDb();
    const service = createCharterDecisionService(db);

    const decision = await service.create(makeCreateDecisionInput());

    expect(decision.status).toBe('pending');
    expect(decision.confidence).toBe(50);
    expect(decision.decisionType).toBe('approval');
    expect(decision.linkedTable).toBe('rights');
  });

  it('returns null for nonexistent decision', async () => {
    const db = makeMockDb();
    const service = createCharterDecisionService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('filters decisions by linkedTable', async () => {
    const db = makeMockDb();
    const service = createCharterDecisionService(db);

    await service.create(
      makeCreateDecisionInput({ linkedTable: 'rights' }),
    );
    await service.create(
      makeCreateDecisionInput({ linkedTable: 'rights' }),
    );
    await service.create(
      makeCreateDecisionInput({ linkedTable: 'obligations' }),
    );

    const rightsDecisions = await service.list({
      linkedTable: 'rights',
    });
    expect(rightsDecisions).toHaveLength(2);
    expect(rightsDecisions.every((d) => d.linkedTable === 'rights')).toBe(
      true,
    );

    const obligationDecisions = await service.list({
      linkedTable: 'obligations',
    });
    expect(obligationDecisions).toHaveLength(1);
  });

  it('updates decision fields', async () => {
    const db = makeMockDb();
    const service = createCharterDecisionService(db);

    const decision = await service.create(makeCreateDecisionInput());
    const deciderId = '00000000-0000-0000-0000-000000000999';

    const updated = await service.update(decision.id, {
      status: 'final',
      confidence: 92,
      decidedBy: deciderId,
      rationale: 'Evidence supports approval',
      outcome: { approved: true },
    });

    expect(updated.status).toBe('final');
    expect(updated.confidence).toBe(92);
    expect(updated.decidedBy).toBe(deciderId);
    expect(updated.rationale).toBe('Evidence supports approval');
    expect(updated.outcome).toEqual({ approved: true });
  });
});
