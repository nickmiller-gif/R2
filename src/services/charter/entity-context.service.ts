import type { CharterContextStatus } from '../../types/charter/types.js';
import type {
  AssetRegistryEntry,
  AssetEvidenceLink,
  CreateAssetRegistryInput,
  CreateEvidenceLinkInput,
  EvidenceLinkKind,
} from '../../types/shared/asset-registry.js';
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

/** Port for deep linking Charter entities into the asset/entity graph. */
export interface AssetRegistryPort {
  getAssetByRef(kind: string, refId: string, domain: string): Promise<AssetRegistryEntry | null>;
  registerAsset(input: CreateAssetRegistryInput): Promise<AssetRegistryEntry>;
  linkAssets(input: CreateEvidenceLinkInput): Promise<AssetEvidenceLink>;
  getLinksFrom(assetId: string): Promise<AssetEvidenceLink[]>;
}

export interface CharterEntityContextService {
  linkEntity(entityId: string, sourcePlatform: string, sourceRecordId: string): Promise<CharterContextSnapshot>;
  refreshContext(entityId: string): Promise<CharterContextSnapshot>;
  getContextSnapshot(entityId: string): Promise<CharterContextSnapshot | null>;
  /** Resolve the asset registry entry for a Charter entity via its canonical_entity_id. */
  resolveAssetEntry(entityId: string): Promise<AssetRegistryEntry | null>;
  /** Ensure the Charter entity is registered in the asset graph; creates the entry if absent. */
  ensureAssetRegistered(entityId: string, label: string): Promise<AssetRegistryEntry>;
  /** Create a typed evidence link from this Charter entity's asset to another registered asset. */
  linkEntityToAsset(
    entityId: string,
    toAssetId: string,
    linkKind: EvidenceLinkKind,
    confidence?: number,
  ): Promise<AssetEvidenceLink>;
  /** Get all outgoing evidence links for this Charter entity's asset entry. */
  getEntityAssetLinks(entityId: string): Promise<AssetEvidenceLink[]>;
}

export function createCharterEntityContextService(
  db: EntityContextDb,
  graph: EntityGraphLookup,
  assets?: AssetRegistryPort,
): CharterEntityContextService {
  async function resolveAssetEntry(entityId: string): Promise<AssetRegistryEntry | null> {
    if (!assets) return null;
    const entity = await db.findEntityById(entityId);
    if (!entity?.canonical_entity_id) return null;
    return assets.getAssetByRef('governance_entity', entity.canonical_entity_id, 'charter');
  }

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

    resolveAssetEntry,

    async ensureAssetRegistered(entityId, label) {
      if (!assets) throw new Error('Asset registry port not provided');
      const entity = await db.findEntityById(entityId);
      if (!entity) throw new Error(`Charter entity not found: ${entityId}`);
      if (!entity.canonical_entity_id) throw new Error(`Entity ${entityId} has no canonical ID`);

      const existing = await assets.getAssetByRef('governance_entity', entity.canonical_entity_id, 'charter');
      if (existing) return existing;

      return assets.registerAsset({
        kind: 'governance_entity',
        refId: entity.canonical_entity_id,
        domain: 'charter',
        label,
      });
    },

    async linkEntityToAsset(entityId, toAssetId, linkKind, confidence) {
      if (!assets) throw new Error('Asset registry port not provided');
      const entry = await resolveAssetEntry(entityId);
      if (!entry) throw new Error(`No asset entry found for charter entity ${entityId}`);
      return assets.linkAssets({ fromAssetId: entry.id, toAssetId, linkKind, confidence });
    },

    async getEntityAssetLinks(entityId) {
      if (!assets) return [];
      const entry = await resolveAssetEntry(entityId);
      if (!entry) return [];
      return assets.getLinksFrom(entry.id);
    },
  };
}
