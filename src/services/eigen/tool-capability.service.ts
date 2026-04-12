/**
 * Tool Capability Service — structured tool manifest for policy-aware routing.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  ToolCapability,
  CreateToolCapabilityInput,
  ToolCapabilityFilter,
} from '../../types/eigen/tool-capability.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbArray } from '../oracle/oracle-db-utils.js';

export interface ToolCapabilityService {
  register(input: CreateToolCapabilityInput): Promise<ToolCapability>;
  getById(id: string): Promise<ToolCapability | null>;
  list(filter?: ToolCapabilityFilter): Promise<ToolCapability[]>;
  update(id: string, input: Partial<CreateToolCapabilityInput>): Promise<ToolCapability>;
}

export interface DbToolCapabilityRow {
  id: string;
  tool_id: string;
  name: string;
  capability_tags: string;
  io_schema_ref: string | null;
  mode: string;
  approval_policy: string;
  role_requirements: string;
  connector_dependencies: string;
  blast_radius: string | null;
  fallback_mode: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCapabilityDb {
  insertCapability(row: DbToolCapabilityRow): Promise<DbToolCapabilityRow>;
  findCapabilityById(id: string): Promise<DbToolCapabilityRow | null>;
  queryCapabilities(filter?: ToolCapabilityFilter): Promise<DbToolCapabilityRow[]>;
  updateCapability(id: string, patch: Partial<DbToolCapabilityRow>): Promise<DbToolCapabilityRow>;
}

function rowToCapability(row: DbToolCapabilityRow): ToolCapability {
  return {
    id: row.id,
    toolId: row.tool_id,
    name: row.name,
    capabilityTags: parseJsonbArray(row.capability_tags) as string[],
    ioSchemaRef: row.io_schema_ref,
    mode: row.mode as ToolCapability['mode'],
    approvalPolicy: row.approval_policy as ToolCapability['approvalPolicy'],
    roleRequirements: parseJsonbArray(row.role_requirements) as string[],
    connectorDependencies: parseJsonbArray(row.connector_dependencies) as string[],
    blastRadius: row.blast_radius,
    fallbackMode: row.fallback_mode,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createToolCapabilityService(db: ToolCapabilityDb): ToolCapabilityService {
  return {
    async register(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertCapability({
        id: crypto.randomUUID(),
        tool_id: input.toolId,
        name: input.name,
        capability_tags: JSON.stringify(input.capabilityTags ?? []),
        io_schema_ref: input.ioSchemaRef ?? null,
        mode: input.mode,
        approval_policy: input.approvalPolicy ?? 'none_required',
        role_requirements: JSON.stringify(input.roleRequirements ?? []),
        connector_dependencies: JSON.stringify(input.connectorDependencies ?? []),
        blast_radius: input.blastRadius ?? null,
        fallback_mode: input.fallbackMode ?? null,
        created_at: now,
        updated_at: now,
      });
      return rowToCapability(row);
    },

    async getById(id) {
      const row = await db.findCapabilityById(id);
      return row ? rowToCapability(row) : null;
    },

    async list(filter) {
      const rows = await db.queryCapabilities(filter);
      return rows.map(rowToCapability);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbToolCapabilityRow> = {
        updated_at: now,
      };
      if (input.name !== undefined) patch.name = input.name;
      if (input.capabilityTags !== undefined) patch.capability_tags = JSON.stringify(input.capabilityTags);
      if (input.ioSchemaRef !== undefined) patch.io_schema_ref = input.ioSchemaRef;
      if (input.mode !== undefined) patch.mode = input.mode;
      if (input.approvalPolicy !== undefined) patch.approval_policy = input.approvalPolicy;
      if (input.roleRequirements !== undefined) patch.role_requirements = JSON.stringify(input.roleRequirements);
      if (input.connectorDependencies !== undefined)
        patch.connector_dependencies = JSON.stringify(input.connectorDependencies);
      if (input.blastRadius !== undefined) patch.blast_radius = input.blastRadius;
      if (input.fallbackMode !== undefined) patch.fallback_mode = input.fallbackMode;

      const row = await db.updateCapability(id, patch);
      return rowToCapability(row);
    },
  };
}
