/**
 * Tests for the Charter right service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterRightService,
  type CharterRightDb,
  type DbCharterRightRow,
} from '../../src/services/charter/right.service.js';
import type { CharterRightFilter } from '../../src/types/charter/types.js';
import {
  makeCreateRightInput,
  resetFixtureCounter,
} from './fixtures/charter-domain-fixtures.js';

function makeMockDb(): CharterRightDb & { rows: DbCharterRightRow[] } {
  const rows: DbCharterRightRow[] = [];
  return {
    rows,
    async insertRight(row) {
      rows.push(row);
      return row;
    },
    async findRightById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryRights(filter?: CharterRightFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.entityId && r.entity_id !== filter.entityId) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateRight(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Right not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('CharterRightService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates a right with pending status and confidence 50', async () => {
    const db = makeMockDb();
    const service = createCharterRightService(db);

    const right = await service.create(makeCreateRightInput());

    expect(right.status).toBe('pending');
    expect(right.confidence).toBe(50);
    expect(right.rightType).toBe('license');
    expect(right.title).toContain('Test Right');
  });

  it('returns null for nonexistent right', async () => {
    const db = makeMockDb();
    const service = createCharterRightService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('filters rights by entityId', async () => {
    const db = makeMockDb();
    const service = createCharterRightService(db);
    const entityId = '00000000-0000-0000-0000-000000000099';
    const otherEntityId = '00000000-0000-0000-0000-000000000098';

    await service.create(makeCreateRightInput({ entityId }));
    await service.create(makeCreateRightInput({ entityId }));
    await service.create(makeCreateRightInput({ entityId: otherEntityId }));

    const filtered = await service.list({ entityId });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.entityId === entityId)).toBe(true);
  });

  it('updates right fields', async () => {
    const db = makeMockDb();
    const service = createCharterRightService(db);

    const right = await service.create(makeCreateRightInput());
    const updated = await service.update(right.id, {
      status: 'active',
      confidence: 95,
      title: 'Updated Title',
    });

    expect(updated.status).toBe('active');
    expect(updated.confidence).toBe(95);
    expect(updated.title).toBe('Updated Title');
  });
});
