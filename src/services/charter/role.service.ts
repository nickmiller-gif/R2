import type {
  CharterUserRole,
  CharterRole,
  AssignCharterRoleInput,
  CharterUserRoleFilter,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface CharterRoleService {
  assign(input: AssignCharterRoleInput): Promise<CharterUserRole>;
  getByUserId(userId: string): Promise<CharterUserRole[]>;
  list(filter?: CharterUserRoleFilter): Promise<CharterUserRole[]>;
  revoke(id: string): Promise<void>;
}

export interface CharterRoleDb {
  insertRole(row: DbCharterUserRoleRow): Promise<DbCharterUserRoleRow>;
  findRolesByUserId(userId: string): Promise<DbCharterUserRoleRow[]>;
  queryRoles(filter?: CharterUserRoleFilter): Promise<DbCharterUserRoleRow[]>;
  deleteRole(id: string): Promise<void>;
}

export interface DbCharterUserRoleRow {
  id: string;
  user_id: string;
  role: CharterRole;
  assigned_by: string;
  created_at: string;
  updated_at: string;
}

function rowToUserRole(row: DbCharterUserRoleRow): CharterUserRole {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    assignedBy: row.assigned_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterRoleService(db: CharterRoleDb): CharterRoleService {
  return {
    async assign(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertRole({
        id: crypto.randomUUID(),
        user_id: input.userId,
        role: input.role,
        assigned_by: input.assignedBy,
        created_at: now,
        updated_at: now,
      });
      return rowToUserRole(row);
    },

    async getByUserId(userId) {
      const rows = await db.findRolesByUserId(userId);
      return rows.map(rowToUserRole);
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryRoles({ ...filter, limit, offset });
      return rows.map(rowToUserRole);
    },

    async revoke(id) {
      await db.deleteRole(id);
    },
  };
}
