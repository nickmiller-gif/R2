/**
 * MEG entity lookup port — domain-boundary contract for resolving MEG entities.
 *
 * Any domain (Oracle, Eigen, Charter) that needs to validate or resolve a MEG
 * entity reference uses this port instead of importing MEG services directly.
 * This keeps domain boundaries clean and the MEG service layer swappable.
 *
 * Follows the same pattern as Charter's EntityGraphLookup.
 */

import type { MegEntityType, MegEntityStatus } from '../../types/meg/entity.js';

/** Minimal MEG entity view returned by the lookup port — just enough for validation and display. */
export interface MegEntityRef {
  id: string;
  entityType: MegEntityType;
  canonicalName: string;
  status: MegEntityStatus;
}

/** Resolved alias hit from the MEG alias table. */
export interface MegAliasHit {
  megEntityId: string;
  aliasKind: string;
  aliasValue: string;
  confidence: number;
}

/**
 * Port interface for cross-domain MEG entity resolution.
 *
 * Implementations may be backed by the real MEG service, a Supabase RPC,
 * or a test fixture. Consumers should never reach past this interface.
 */
export interface MegEntityLookup {
  /** Validate and return a MEG entity by its canonical ID. Returns null if not found or not active. */
  getActiveEntity(id: string): Promise<MegEntityRef | null>;

  /** Resolve a MEG entity from any alias value (slug, external_id, display_name, etc.). */
  resolveByAlias(aliasValue: string): Promise<MegAliasHit[]>;

  /** Check whether a MEG entity exists and is active. Fast validation path — no full entity load. */
  isActive(id: string): Promise<boolean>;
}

/**
 * Factory that adapts the MEG service layer into the lookup port.
 *
 * The `deps` shape intentionally avoids importing the full MegEntityService —
 * it only requires the two methods the port needs.
 */
export interface MegEntityLookupDeps {
  findEntityById(id: string): Promise<{ id: string; entity_type: string; canonical_name: string; status: string } | null>;
  findAliasesByValue(aliasValue: string): Promise<Array<{ meg_entity_id: string; alias_kind: string; alias_value: string; confidence: number }>>;
}

export function createMegEntityLookup(deps: MegEntityLookupDeps): MegEntityLookup {
  return {
    async getActiveEntity(id) {
      const row = await deps.findEntityById(id);
      if (!row || row.status !== 'active') return null;
      return {
        id: row.id,
        entityType: row.entity_type as MegEntityType,
        canonicalName: row.canonical_name,
        status: row.status as MegEntityStatus,
      };
    },

    async resolveByAlias(aliasValue) {
      const rows = await deps.findAliasesByValue(aliasValue);
      return rows.map((r) => ({
        megEntityId: r.meg_entity_id,
        aliasKind: r.alias_kind,
        aliasValue: r.alias_value,
        confidence: r.confidence,
      }));
    },

    async isActive(id) {
      const row = await deps.findEntityById(id);
      return row !== null && row.status === 'active';
    },
  };
}
