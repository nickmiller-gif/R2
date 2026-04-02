import type { CharterContextStatus } from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface CharterContextSnapshot {
  sourcePlatform: string;
  sourceRecordId: string;
  canonicalEntityId: string | null;
  contextStatus: CharterContextStatus;
  upstreamName: string | null;
  upstreamType: string | null;
  lastContextSyncAt: Date | null;
}

export interface DbCharterEntityRow {
  id: string;
  entity_type: string;
  name: string;
  metadata: string;
  status: string;
  confidence: number;
  created_by: string;
  reviewed_by: string | null;
  canonical_entity_id: string | null;
  source_platform: string | null;
  source_record_id: string | null;
  context_status: string;
  last_context_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityContextDb {
  findEntityById(id: string): Promise<DbCharterEntityRow | null>;
  updateEntity(id: string, patch: Partial<DbCharterEntityRow>): Promise<DbCharterEntityRow>;
}

export interface EntityGraphLookup {
  resolveCanonicalId(sourcePlatform: string, sourceRecordId: string): Promise<string | null>;
  fetchUpstreamContext(canonicalId: string): Promise<{ name: string | null; type: string | null } | null>;
}

export interface CharterEntityContextService {
  linkEntity(entityId: string, sourcePlatform: string, sourceRecordId: string): Promise<CharterContextSnapshot>;
  refreshContext(entityId: string): Promise<CharterContextSnapshot>;
  getContextSnapshot(entityId: string): Promise<CharterContextSnapshot | null>;
}

export function createCharterEntityContextService(
  db: EntityContextDb,
  graph: EntityGraphLookup,
): CharterEntityContextService {
  return {
    async linkEntity(entityId, sourcePlatform, sourceRecordId) {
      const canonicalId = await graph.resolveCanonicalId(sourcePlatform, sourceRecordId);
      const upstream = canonicalId ? await graph.fetchUpstreamContext(canonicalId) : null;
      const now = nowUtc().toISOString();

      const row = await db.updateEntity(entityId, {
        source_platform: sourcePlatform,
        source_record_id: sourceRecordId,
        canonical_entity_id: canonicalId ?? undefined,
        context_status: canonicalId ? 'linked' : 'unlinked',
        last_context_sync_at: now,
        updated_at: now,
      });

      return {
        sourcePlatform: row.source_platform!,
        sourceRecordId: row.source_record_id!,
        canonicalEntityId: row.canonical_entity_id ?? null,
        contextStatus: row.context_status as CharterContextStatus,
        upstreamName: upstream?.name ?? null,
        upstreamType: upstream?.type ?? null,
        lastContextSyncAt: row.last_context_sync_at ? new Date(row.last_context_sync_at) : null,
      };
    },

    async refreshContext(entityId) {
      const entity = await db.findEntityById(entityId);
      if (!entity) throw new Error(`Charter entity not found: ${entityId}`);
      if (!entity.source_platform || !entity.source_record_id) {
        throw new Error(`Entity ${entityId} has no linked source`);
      }

      const canonicalId = await graph.resolveCanonicalId(entity.source_platform, entity.source_record_id);
      const upstream = canonicalId ? await graph.fetchUpstreamContext(canonicalId) : null;
      const now = nowUtc().toISOString();
      const newStatus: CharterContextStatus = canonicalId ? 'linked' : 'stale';

      const row = await db.updateEntity(entityId, {
        canonical_entity_id: canonicalId ?? undefined,
        context_status: newStatus,
        last_context_sync_at: now,
        updated_at: now,
      });

      return {
        sourcePlatform: row.source_platform!,
        sourceRecordId: row.source_record_id!,
        canonicalEntityId: row.canonical_entity_id ?? null,
        contextStatus: row.context_status as CharterContextStatus,
        upstreamName: upstream?.name ?? null,
        upstreamType: upstream?.type ?? null,
        lastContextSyncAt: row.last_context_sync_at ? new Date(row.last_context_sync_at) : null,
      };
    },

    async getContextSnapshot(entityId) {
      const entity = await db.findEntityById(entityId);
      if (!entity) return null;
      if (!entity.source_platform) return null;

      return {
        sourcePlatform: entity.source_platform,
        sourceRecordId: entity.source_record_id!,
        canonicalEntityId: entity.canonical_entity_id ?? null,
        contextStatus: entity.context_status as CharterContextStatus,
        upstreamName: null,
        upstreamType: null,
        lastContextSyncAt: entity.last_context_sync_at ? new Date(entity.last_context_sync_at) : null,
      };
    },
  };
}
