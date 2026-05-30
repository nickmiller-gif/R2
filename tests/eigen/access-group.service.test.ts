/**
 * Tests for Eigen access group service.
 */
import { describe, expect, it } from 'vitest';
import {
  createEigenAccessGroupService,
  slugifyAccessGroupSlug,
  type DbEigenAccessGroupMemberRow,
  type DbEigenAccessGroupRow,
  type EigenAccessGroupDb,
} from '../../src/services/eigen/access-group.service.js';
import { policyTagEigenxGroup } from '../../src/lib/eigen/eigen-access-groups.js';

const USER = '11111111-1111-1111-1111-111111111111';
const GROUP_A = '22222222-2222-2222-2222-222222222222';

function baseGroup(overrides: Partial<DbEigenAccessGroupRow> = {}): DbEigenAccessGroupRow {
  return {
    id: GROUP_A,
    slug: 'forma-team',
    label: 'Forma Team',
    status: 'active',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockDb(
  initial: {
    groups?: DbEigenAccessGroupRow[];
    members?: DbEigenAccessGroupMemberRow[];
  } = {},
): EigenAccessGroupDb & {
  groups: DbEigenAccessGroupRow[];
  members: DbEigenAccessGroupMemberRow[];
} {
  const groups = [...(initial.groups ?? [])];
  const members = [...(initial.members ?? [])];

  return {
    groups,
    members,
    async listAllGroups() {
      return [...groups].sort((a, b) => a.label.localeCompare(b.label));
    },
    async listGroupsByIds(groupIds, status = 'active') {
      return groups.filter((g) => groupIds.includes(g.id) && g.status === status);
    },
    async getGroupById(groupId) {
      return groups.find((g) => g.id === groupId) ?? null;
    },
    async listMembershipsForUser(userId) {
      return members.filter((m) => m.user_id === userId);
    },
    async insertGroup(row) {
      const created: DbEigenAccessGroupRow = {
        id: crypto.randomUUID(),
        slug: row.slug,
        label: row.label,
        status: 'active',
        metadata: row.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      groups.push(created);
      return created;
    },
    async upsertMember(input) {
      const existing = members.find(
        (m) => m.group_id === input.groupId && m.user_id === input.userId,
      );
      if (existing) {
        existing.role = input.role;
        return;
      }
      members.push({
        group_id: input.groupId,
        user_id: input.userId,
        role: input.role,
        joined_at: new Date().toISOString(),
      });
    },
    async removeMember(groupId, userId) {
      const idx = members.findIndex((m) => m.group_id === groupId && m.user_id === userId);
      if (idx >= 0) members.splice(idx, 1);
    },
    async archiveGroup(groupId, updatedAt) {
      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error('group not found');
      group.status = 'archived';
      group.updated_at = updatedAt;
    },
  };
}

describe('slugifyAccessGroupSlug', () => {
  it('normalizes labels to kebab-case', () => {
    expect(slugifyAccessGroupSlug('Forma Team')).toBe('forma-team');
    expect(slugifyAccessGroupSlug('  Deal Team #2  ')).toBe('deal-team-2');
  });
});

describe('EigenAccessGroupService', () => {
  it('lists all groups for admin', async () => {
    const db = makeMockDb({
      groups: [baseGroup({ id: 'a', label: 'B Team' }), baseGroup({ id: 'b', label: 'A Team' })],
    });
    const svc = createEigenAccessGroupService(db);
    const groups = await svc.listAllForAdmin();
    expect(groups.map((g) => g.label)).toEqual(['A Team', 'B Team']);
    expect(groups[0].policyTag).toBe(policyTagEigenxGroup('b'));
  });

  it('lists member groups with membership and policy tags', async () => {
    const db = makeMockDb({
      groups: [baseGroup()],
      members: [
        {
          group_id: GROUP_A,
          user_id: USER,
          role: 'member',
          joined_at: '2026-02-01T00:00:00.000Z',
        },
      ],
    });
    const svc = createEigenAccessGroupService(db);
    const groups = await svc.listForMember(USER);
    expect(groups).toHaveLength(1);
    expect(groups[0].policyTag).toBe(policyTagEigenxGroup(GROUP_A));
    expect(groups[0].membership?.role).toBe('member');
  });

  it('returns empty list when user has no memberships', async () => {
    const db = makeMockDb({ groups: [baseGroup()] });
    const svc = createEigenAccessGroupService(db);
    expect(await svc.listForMember(USER)).toEqual([]);
  });

  it('creates a group with slugified slug', async () => {
    const db = makeMockDb();
    const svc = createEigenAccessGroupService(db);
    const group = await svc.createGroup({ label: 'New Team' });
    expect(group.slug).toBe('new-team');
    expect(group.label).toBe('New Team');
    expect(db.groups).toHaveLength(1);
  });

  it('rejects create without label', async () => {
    const svc = createEigenAccessGroupService(makeMockDb());
    await expect(svc.createGroup({ label: '   ' })).rejects.toThrow(/label/);
  });

  it('adds and removes members', async () => {
    const db = makeMockDb({ groups: [baseGroup()] });
    const svc = createEigenAccessGroupService(db);
    await svc.addMember({ groupId: GROUP_A, userId: USER });
    expect(db.members).toHaveLength(1);
    await svc.removeMember({ groupId: GROUP_A, userId: USER });
    expect(db.members).toHaveLength(0);
  });

  it('archives a group', async () => {
    const db = makeMockDb({ groups: [baseGroup()] });
    const svc = createEigenAccessGroupService(db);
    await svc.archiveGroup(GROUP_A);
    expect(db.groups[0].status).toBe('archived');
  });

  it('rejects add/remove member on archived groups', async () => {
    const db = makeMockDb({ groups: [baseGroup({ status: 'archived' })] });
    const svc = createEigenAccessGroupService(db);
    await expect(svc.addMember({ groupId: GROUP_A, userId: USER })).rejects.toThrow(/archived/);
    await expect(svc.removeMember({ groupId: GROUP_A, userId: USER })).rejects.toThrow(/archived/);
  });

  it('rejects archive when group does not exist', async () => {
    const svc = createEigenAccessGroupService(makeMockDb());
    await expect(svc.archiveGroup(GROUP_A)).rejects.toThrow(/group not found/);
  });

  it('archiving an already-archived group is idempotent', async () => {
    const db = makeMockDb({ groups: [baseGroup({ status: 'archived' })] });
    const svc = createEigenAccessGroupService(db);
    await expect(svc.archiveGroup(GROUP_A)).resolves.toBeUndefined();
    expect(db.groups[0].status).toBe('archived');
  });
});
