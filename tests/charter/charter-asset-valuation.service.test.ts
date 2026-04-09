/**
 * Tests for Charter asset valuations (MEG-anchored).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterAssetValuationService,
  type CharterAssetValuationDb,
  type DbCharterAssetValuationRow,
} from '../../src/services/charter/charter-asset-valuation.service.js';
import type { CharterAssetValuationFilter } from '../../src/types/charter/types.js';

const MEG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeMockDb(): CharterAssetValuationDb & { rows: DbCharterAssetValuationRow[] } {
  const rows: DbCharterAssetValuationRow[] = [];
  return {
    rows,
    async insertRow(row) {
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async query(filter?: CharterAssetValuationFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.megEntityId && r.meg_entity_id !== filter.megEntityId) return false;
        if (filter.charterEntityId && r.charter_entity_id !== filter.charterEntityId) return false;
        if (filter.valuationKind && r.valuation_kind !== filter.valuationKind) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateRow(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Valuation not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('CharterAssetValuationService', () => {
  beforeEach(() => {});

  it('creates valuation with defaults', async () => {
    const db = makeMockDb();
    const service = createCharterAssetValuationService(db);
    const v = await service.create({
      megEntityId: MEG_A,
      valuationKind: 'market',
      amountNumeric: '1250000.50',
      asOf: '2026-04-01T00:00:00.000Z',
      createdBy: 'user-1',
    });
    expect(v.currency).toBe('USD');
    expect(v.confidence).toBe(50);
    expect(v.status).toBe('draft');
    expect(Number(v.amountNumeric)).toBeCloseTo(1250000.5);
    expect(v.megEntityId).toBe(MEG_A);
  });

  it('filters by megEntityId', async () => {
    const db = makeMockDb();
    const service = createCharterAssetValuationService(db);
    await service.create({
      megEntityId: MEG_A,
      valuationKind: 'book',
      amountNumeric: '100',
      asOf: '2026-04-01T00:00:00.000Z',
      createdBy: 'u1',
    });
    await service.create({
      megEntityId: MEG_B,
      valuationKind: 'insurance',
      amountNumeric: '200',
      asOf: '2026-04-01T00:00:00.000Z',
      createdBy: 'u1',
    });
    const list = await service.list({ megEntityId: MEG_A });
    expect(list).toHaveLength(1);
    expect(list[0].valuationKind).toBe('book');
  });

  it('rejects negative amount', async () => {
    const service = createCharterAssetValuationService(makeMockDb());
    await expect(
      service.create({
        megEntityId: MEG_A,
        valuationKind: 'market',
        amountNumeric: '-1',
        asOf: '2026-04-01T00:00:00.000Z',
        createdBy: 'u1',
      }),
    ).rejects.toThrow(/non-negative/);
  });

  it('updates status and supersession', async () => {
    const service = createCharterAssetValuationService(makeMockDb());
    const first = await service.create({
      megEntityId: MEG_A,
      valuationKind: 'charter_basis',
      amountNumeric: '500000',
      asOf: '2025-01-01T00:00:00.000Z',
      createdBy: 'u1',
    });
    const second = await service.create({
      megEntityId: MEG_A,
      valuationKind: 'charter_basis',
      amountNumeric: '520000',
      asOf: '2026-01-01T00:00:00.000Z',
      supersedesId: first.id,
      status: 'active',
      reviewedBy: 'reviewer-1',
      createdBy: 'u1',
    });
    expect(second.supersedesId).toBe(first.id);
    const updated = await service.update(first.id, { status: 'superseded', reviewedBy: 'reviewer-1' });
    expect(updated.status).toBe('superseded');
    expect(updated.reviewedBy).toBe('reviewer-1');
  });

  it('rejects active status without reviewer on create', async () => {
    const service = createCharterAssetValuationService(makeMockDb());
    await expect(
      service.create({
        megEntityId: MEG_A,
        valuationKind: 'market',
        amountNumeric: '1',
        asOf: '2026-04-01T00:00:00.000Z',
        status: 'active',
        createdBy: 'u1',
      }),
    ).rejects.toThrow(/reviewedBy/);
  });

  it('rejects promoting to active without reviewer', async () => {
    const service = createCharterAssetValuationService(makeMockDb());
    const v = await service.create({
      megEntityId: MEG_A,
      valuationKind: 'book',
      amountNumeric: '99',
      asOf: '2026-04-01T00:00:00.000Z',
      createdBy: 'u1',
    });
    await expect(service.update(v.id, { status: 'active' })).rejects.toThrow(/reviewedBy/);
    const ok = await service.update(v.id, { status: 'active', reviewedBy: 'rev-2' });
    expect(ok.status).toBe('active');
    expect(ok.reviewedBy).toBe('rev-2');
  });
});
