/**
 * Tests for the Charter obligation service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterObligationService,
  type CharterObligationDb,
  type DbCharterObligationRow,
} from '../../src/services/charter/obligation.service.js';
import type { CharterObligationFilter } from '../../src/types/charter/types.js';
import {
  makeCreateObligationInput,
  resetFixtureCounter,
} from './fixtures/charter-domain-fixtures.js';

function makeMockDb(): CharterObligationDb & { rows: DbCharterObligationRow[] } {
  const rows: DbCharterObligationRow[] = [];
  return {
    rows,
    async insertObligation(row) {
      rows.push(row);
      return row;
    },
    async findObligationById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryObligations(filter?: CharterObligationFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.entityId && r.entity_id !== filter.entityId) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateObligation(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Obligation not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('CharterObligationService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates an obligation with pending status and confidence 50', async () => {
    const db = makeMockDb();
    const service = createCharterObligationService(db);

    const obligation = await service.create(makeCreateObligationInput());

    expect(obligation.status).toBe('pending');
    expect(obligation.confidence).toBe(50);
    expect(obligation.obligationType).toBe('compliance');
    expect(obligation.title).toContain('Test Obligation');
  });

  it('returns null for nonexistent obligation', async () => {
    const db = makeMockDb();
    const service = createCharterObligationService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('filters obligations by entityId', async () => {
    const db = makeMockDb();
    const service = createCharterObligationService(db);
    const entityId = '00000000-0000-0000-0000-000000000099';
    const otherEntityId = '00000000-0000-0000-0000-000000000098';

    await service.create(makeCreateObligationInput({ entityId }));
    await service.create(makeCreateObligationInput({ entityId }));
    await service.create(makeCreateObligationInput({ entityId: otherEntityId }));

    const filtered = await service.list({ entityId });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((o) => o.entityId === entityId)).toBe(true);
  });

  it('updates obligation fields', async () => {
    const db = makeMockDb();
    const service = createCharterObligationService(db);

    const obligation = await service.create(makeCreateObligationInput());
    const updated = await service.update(obligation.id, {
      status: 'fulfilled',
      confidence: 85,
      title: 'Updated Obligation',
    });

    expect(updated.status).toBe('fulfilled');
    expect(updated.confidence).toBe(85);
    expect(updated.title).toBe('Updated Obligation');
  });
});
