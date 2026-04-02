/**
 * Tests for the Charter role service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterRoleService,
  type CharterRoleDb,
  type DbCharterUserRoleRow,
} from '../../src/services/charter/role.service.js';
import type { CharterUserRoleFilter } from '../../src/types/charter/types.js';
import {
  makeAssignRoleInput,
  resetFixtureCounter,
} from './fixtures/charter-domain-fixtures.js';

function makeMockDb(): CharterRoleDb & { rows: DbCharterUserRoleRow[] } {
  const rows: DbCharterUserRoleRow[] = [];
  return {
    rows,
    async insertRole(row) {
      rows.push(row);
      return row;
    },
    async findRolesByUserId(userId) {
      return rows.filter((r) => r.user_id === userId);
    },
    async queryRoles(filter?: CharterUserRoleFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.role && r.role !== filter.role) return false;
        if (filter.userId && r.user_id !== filter.userId) return false;
        return true;
      });
    },
    async deleteRole(id) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Role not found: ${id}`);
      rows.splice(idx, 1);
    },
  };
}

describe('CharterRoleService', () => {
  beforeEach(() => resetFixtureCounter());

  it('assigns a role to a user', async () => {
    const db = makeMockDb();
    const service = createCharterRoleService(db);

    const role = await service.assign(makeAssignRoleInput());

    expect(role.role).toBe('reviewer');
    expect(role.userId).toBeTruthy();
    expect(role.assignedBy).toBeTruthy();
    expect(role.createdAt).toBeInstanceOf(Date);
  });

  it('retrieves roles by userId', async () => {
    const db = makeMockDb();
    const service = createCharterRoleService(db);
    const userId = '00000000-0000-0000-0000-000000000099';

    await service.assign(makeAssignRoleInput({ userId, role: 'reviewer' }));
    await service.assign(makeAssignRoleInput({ userId, role: 'reviewer' }));
    await service.assign(
      makeAssignRoleInput({
        userId: '00000000-0000-0000-0000-000000000098',
        role: 'reviewer',
      }),
    );

    const userRoles = await service.getByUserId(userId);
    expect(userRoles).toHaveLength(2);
    expect(userRoles.every((r) => r.userId === userId)).toBe(true);
  });

  it('revokes a role', async () => {
    const db = makeMockDb();
    const service = createCharterRoleService(db);

    const role = await service.assign(makeAssignRoleInput());
    expect(db.rows).toHaveLength(1);

    await service.revoke(role.id);
    expect(db.rows).toHaveLength(0);
  });

  it('filters roles by role type', async () => {
    const db = makeMockDb();
    const service = createCharterRoleService(db);

    await service.assign(makeAssignRoleInput({ role: 'reviewer' }));
    await service.assign(makeAssignRoleInput({ role: 'reviewer' }));
    await service.assign(makeAssignRoleInput({ role: 'reviewer' }));
    await service.assign(makeAssignRoleInput({ role: 'operator' }));

    const reviewers = await service.list({ role: 'reviewer' });
    expect(reviewers).toHaveLength(3);
    expect(reviewers.every((r) => r.role === 'reviewer')).toBe(true);

    const operators = await service.list({ role: 'operator' });
    expect(operators).toHaveLength(1);
    expect(operators[0].role).toBe('operator');
  });
});
