/**
 * EigenX access groups — admin CRUD and member listing (service_role path).
 */

import { policyTagEigenxGroup } from '../../lib/eigen/eigen-access-groups.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField } from '../oracle/oracle-db-utils.js';
import type {
  AddEigenAccessGroupMemberInput,
  CreateEigenAccessGroupInput,
  EigenAccessGroup,
  EigenAccessGroupMemberRole,
  EigenAccessGroupStatus,
  EigenAccessGroupWithMembership,
  RemoveEigenAccessGroupMemberInput,
} from '../../types/eigen/access-group.js';

export interface DbEigenAccessGroupRow {
  id: string;
  slug: string;
  label: string;
  status: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export interface DbEigenAccessGroupMemberRow {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface EigenAccessGroupDb {
  listAllGroups(): Promise<DbEigenAccessGroupRow[]>;
  listGroupsByIds(
    groupIds: string[],
    status?: EigenAccessGroupStatus,
  ): Promise<DbEigenAccessGroupRow[]>;
  listMembershipsForUser(userId: string): Promise<DbEigenAccessGroupMemberRow[]>;
  insertGroup(row: {
    slug: string;
    label: string;
    metadata: Record<string, unknown>;
  }): Promise<DbEigenAccessGroupRow>;
  upsertMember(input: {
    groupId: string;
    userId: string;
    role: EigenAccessGroupMemberRole;
  }): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  archiveGroup(groupId: string, updatedAt: string): Promise<void>;
}

export interface EigenAccessGroupService {
  listAllForAdmin(): Promise<EigenAccessGroup[]>;
  listForMember(userId: string): Promise<EigenAccessGroupWithMembership[]>;
  createGroup(input: CreateEigenAccessGroupInput): Promise<EigenAccessGroup>;
  addMember(input: AddEigenAccessGroupMemberInput): Promise<void>;
  removeMember(input: RemoveEigenAccessGroupMemberInput): Promise<void>;
  archiveGroup(groupId: string): Promise<void>;
}

export function slugifyAccessGroupSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function rowToEntity(row: DbEigenAccessGroupRow): EigenAccessGroup {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    status: row.status as EigenAccessGroupStatus,
    metadata: parseJsonbField(row.metadata),
    policyTag: policyTagEigenxGroup(row.id),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createEigenAccessGroupService(db: EigenAccessGroupDb): EigenAccessGroupService {
  return {
    async listAllForAdmin() {
      const rows = await db.listAllGroups();
      return rows.map(rowToEntity);
    },

    async listForMember(userId) {
      const memberships = await db.listMembershipsForUser(userId);
      if (memberships.length === 0) return [];

      const groupIds = memberships.map((m) => m.group_id);
      const groups = await db.listGroupsByIds(groupIds, 'active');
      const membershipByGroup = new Map(memberships.map((m) => [m.group_id, m]));

      return groups.map((row) => {
        const entity = rowToEntity(row);
        const membership = membershipByGroup.get(row.id);
        return {
          ...entity,
          membership: membership
            ? {
                role: membership.role as EigenAccessGroupMemberRole,
                joinedAt: new Date(membership.joined_at),
              }
            : null,
        };
      });
    },

    async createGroup(input) {
      const label = input.label.trim();
      const slug = slugifyAccessGroupSlug(input.slug ?? label);
      if (!label || !slug) {
        throw new Error('label (and slug) required');
      }

      const row = await db.insertGroup({
        slug,
        label,
        metadata: input.metadata ?? {},
      });
      return rowToEntity(row);
    },

    async addMember(input) {
      const groupId = input.groupId.trim();
      const userId = input.userId.trim();
      if (!groupId || !userId) {
        throw new Error('group_id and user_id required');
      }
      await db.upsertMember({
        groupId,
        userId,
        role: input.role ?? 'member',
      });
    },

    async removeMember(input) {
      const groupId = input.groupId.trim();
      const userId = input.userId.trim();
      if (!groupId || !userId) {
        throw new Error('group_id and user_id required');
      }
      await db.removeMember(groupId, userId);
    },

    async archiveGroup(groupId) {
      const trimmed = groupId.trim();
      if (!trimmed) {
        throw new Error('group_id required');
      }
      await db.archiveGroup(trimmed, nowUtc().toISOString());
    },
  };
}
