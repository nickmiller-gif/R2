/**
 * Tests for the Charter payout service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterPayoutService,
  type CharterPayoutDb,
  type DbCharterPayoutRow,
} from '../../src/services/charter/payout.service.js';
import type { CharterPayoutFilter } from '../../src/types/charter/types.js';
import {
  makeCreatePayoutInput,
  resetFixtureCounter,
} from './fixtures/charter-domain-fixtures.js';

function makeMockDb(): CharterPayoutDb & { rows: DbCharterPayoutRow[] } {
  const rows: DbCharterPayoutRow[] = [];
  return {
    rows,
    async insertPayout(row) {
      rows.push(row);
      return row;
    },
    async findPayoutById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryPayouts(filter?: CharterPayoutFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.entityId && r.entity_id !== filter.entityId) return false;
        return true;
      });
    },
    async updatePayout(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Payout not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('CharterPayoutService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates a payout with pending status and confidence 50', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    const payout = await service.create(makeCreatePayoutInput());

    expect(payout.status).toBe('pending');
    expect(payout.confidence).toBe(50);
    expect(payout.amount).toBe(1000);
    expect(payout.currency).toBe('USD');
  });

  it('returns null for nonexistent payout', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('approve sets status to approved and sets approvedBy', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);
    const approverUserId = '00000000-0000-0000-0000-000000999999';

    const payout = await service.create(makeCreatePayoutInput());
    expect(payout.approvedBy).toBeNull();

    const approved = await service.approve(payout.id, approverUserId);
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe(approverUserId);
  });

  it('filters payouts by status', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    const payout1 = await service.create(makeCreatePayoutInput());
    const payout2 = await service.create(makeCreatePayoutInput());
    const payout3 = await service.create(makeCreatePayoutInput());

    await service.approve(payout1.id, '00000000-0000-0000-0000-000000000001');
    await service.approve(payout2.id, '00000000-0000-0000-0000-000000000002');

    const approved = await service.list({ status: 'approved' });
    expect(approved).toHaveLength(2);
    expect(approved.every((p) => p.status === 'approved')).toBe(true);

    const pending = await service.list({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(payout3.id);
  });

  it('updates payout fields', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    const payout = await service.create(makeCreatePayoutInput());
    const updated = await service.update(payout.id, {
      amount: 2500,
      currency: 'EUR',
      confidence: 90,
    });

    expect(updated.amount).toBe(2500);
    expect(updated.currency).toBe('EUR');
    expect(updated.confidence).toBe(90);
  });

  it('rejects non-positive amount on create', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    await expect(
      service.create(makeCreatePayoutInput({ amount: 0 }))
    ).rejects.toThrow('amount');
  });

  it('rejects negative amount on create', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    await expect(
      service.create(makeCreatePayoutInput({ amount: -100 }))
    ).rejects.toThrow('amount');
  });

  it('rejects confidence out of range on create', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);

    await expect(
      service.create(makeCreatePayoutInput({ confidence: 101 }))
    ).rejects.toThrow('confidence');
  });

  it('rejects non-positive amount on update', async () => {
    const db = makeMockDb();
    const service = createCharterPayoutService(db);
    const payout = await service.create(makeCreatePayoutInput());

    await expect(
      service.update(payout.id, { amount: -1 })
    ).rejects.toThrow('amount');
  });
});
