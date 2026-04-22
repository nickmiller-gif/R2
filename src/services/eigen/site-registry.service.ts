/**
 * Eigen site registry read + policy metadata updates (service_role path).
 */

import type {
  EigenSiteRegistry,
  EigenSiteRegistryFilter,
  EigenSiteMode,
  EigenSiteStatus,
  UpdateEigenSiteRegistryPolicyMetaInput,
} from '../../types/eigen/site-registry.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbArray, parseJsonbField } from '../oracle/oracle-db-utils.js';

export interface DbEigenSiteRegistryRow {
  site_id: string;
  display_name: string;
  mode: string;
  origins: unknown;
  source_systems: unknown;
  default_policy_scope: unknown;
  status: string;
  metadata: unknown;
  policy_notes: string | null;
  capability_profile: unknown;
  created_at: string;
  updated_at: string;
}

export interface EigenSiteRegistryDb {
  findSiteById(siteId: string): Promise<DbEigenSiteRegistryRow | null>;
  querySites(filter?: EigenSiteRegistryFilter): Promise<DbEigenSiteRegistryRow[]>;
  updateSite(siteId: string, patch: Partial<DbEigenSiteRegistryRow>): Promise<DbEigenSiteRegistryRow>;
}

export interface EigenSiteRegistryService {
  getBySiteId(siteId: string): Promise<EigenSiteRegistry | null>;
  list(filter?: EigenSiteRegistryFilter): Promise<EigenSiteRegistry[]>;
  updatePolicyMeta(siteId: string, input: UpdateEigenSiteRegistryPolicyMetaInput): Promise<EigenSiteRegistry>;
}

function rowToEntity(row: DbEigenSiteRegistryRow): EigenSiteRegistry {
  return {
    siteId: row.site_id,
    displayName: row.display_name,
    mode: row.mode as EigenSiteMode,
    origins: parseJsonbArray(row.origins) as string[],
    sourceSystems: parseJsonbArray(row.source_systems) as string[],
    defaultPolicyScope: parseJsonbArray(row.default_policy_scope) as string[],
    status: row.status as EigenSiteStatus,
    metadata: parseJsonbField(row.metadata),
    policyNotes: row.policy_notes,
    capabilityProfile: parseJsonbField(row.capability_profile),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createEigenSiteRegistryService(db: EigenSiteRegistryDb): EigenSiteRegistryService {
  return {
    async getBySiteId(siteId) {
      const row = await db.findSiteById(siteId);
      return row ? rowToEntity(row) : null;
    },

    async list(filter) {
      const rows = await db.querySites(filter);
      return rows.map(rowToEntity);
    },

    async updatePolicyMeta(siteId, input) {
      const patch: Partial<DbEigenSiteRegistryRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.policyNotes !== undefined) patch.policy_notes = input.policyNotes;
      if (input.capabilityProfile !== undefined) {
        patch.capability_profile = JSON.stringify(input.capabilityProfile);
      }
      const row = await db.updateSite(siteId, patch);
      return rowToEntity(row);
    },
  };
}
