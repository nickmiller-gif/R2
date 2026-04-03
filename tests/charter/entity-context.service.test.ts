import { describe, it, expect } from 'vitest';
import {
  createCharterEntityContextService,
  type CharterEntityContextService,
  type EntityContextDb,
  type EntityGraphLookup,
  type AssetRegistryPort,
  type DbCharterEntityRow,
} from '../../src/services/charter/entity-context.service.js';
import type { AssetRegistryEntry, AssetEvidenceLink } from '../../src/types/shared/asset-registry.js';

describe('CharterEntityContextService', () => {
  const createMockDb = (): EntityContextDb & { seed(row: DbCharterEntityRow): void } => {
    const store = new Map<string, DbCharterEntityRow>();

    return {
      seed(row: DbCharterEntityRow) {
        store.set(row.id, row);
      },
      async findEntityById(id: string) {
        return store.get(id) ?? null;
      },
      async updateEntity(id: string, patch: Partial<DbCharterEntityRow>) {
        const existing = store.get(id);
        if (!existing) throw new Error(`Entity ${id} not found`);

        const updated = { ...existing, ...patch };
        store.set(id, updated);
        return updated;
      },
    };
  };

  const createMockGraph = (): EntityGraphLookup & { setCanonical: any; setContext: any } => {
    const canonicalMap = new Map<string, string>();
    const contextMap = new Map<string, { name: string | null; type: string | null }>();

    return {
      async resolveCanonicalId(sourcePlatform: string, sourceRecordId: string) {
        const key = `${sourcePlatform}:${sourceRecordId}`;
        return canonicalMap.get(key) ?? null;
      },
      async fetchUpstreamContext(canonicalId: string) {
        return contextMap.get(canonicalId) ?? null;
      },
      setCanonical(sourcePlatform: string, sourceRecordId: string, canonicalId: string) {
        canonicalMap.set(`${sourcePlatform}:${sourceRecordId}`, canonicalId);
      },
      setContext(canonicalId: string, name: string | null, type: string | null) {
        contextMap.set(canonicalId, { name, type });
      },
    };
  };

  const createTestEntity = (id: string = 'entity-1'): DbCharterEntityRow => ({
    id,
    entity_type: 'person',
    name: 'Test Entity',
    metadata: '{}',
    status: 'active',
    confidence: 100,
    created_by: 'user-1',
    reviewed_by: null,
    canonical_entity_id: null,
    source_platform: null,
    source_record_id: null,
    context_status: 'unlinked',
    last_context_sync_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  describe('linkEntity', () => {
    it('should link successfully when graph resolves canonical ID', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph() as any;
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity();
      mockDb.seed(entity);

      (mockGraph as any).setCanonical('external-source', 'record-123', 'canonical-456');
      (mockGraph as any).setContext('canonical-456', 'Upstream Name', 'upstream-type');

      const snapshot = await service.linkEntity(entity.id, 'external-source', 'record-123');

      expect(snapshot.sourcePlatform).toBe('external-source');
      expect(snapshot.sourceRecordId).toBe('record-123');
      expect(snapshot.canonicalEntityId).toBe('canonical-456');
      expect(snapshot.contextStatus).toBe('linked');
      expect(snapshot.upstreamName).toBe('Upstream Name');
      expect(snapshot.upstreamType).toBe('upstream-type');
    });

    it('should set unlinked when graph returns null', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph() as any;
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity();
      mockDb.seed(entity);

      const snapshot = await service.linkEntity(entity.id, 'unknown-source', 'record-999');

      expect(snapshot.sourcePlatform).toBe('unknown-source');
      expect(snapshot.sourceRecordId).toBe('record-999');
      expect(snapshot.canonicalEntityId).toBeNull();
      expect(snapshot.contextStatus).toBe('unlinked');
      expect(snapshot.upstreamName).toBeNull();
    });
  });

  describe('refreshContext', () => {
    it('should throw for nonexistent entity', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      await expect(service.refreshContext('nonexistent')).rejects.toThrow('Charter entity not found');
    });

    it('should throw when entity has no linked source', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-2');
      mockDb.seed(entity);

      await expect(service.refreshContext(entity.id)).rejects.toThrow('has no linked source');
    });

    it('should update to stale when canonical ID is lost', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph() as any;
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-3');
      entity.source_platform = 'external-source';
      entity.source_record_id = 'record-456';
      entity.canonical_entity_id = 'canonical-789';
      mockDb.seed(entity);

      const snapshot = await service.refreshContext(entity.id);

      expect(snapshot.contextStatus).toBe('stale');
      expect(snapshot.canonicalEntityId).toBeNull();
    });
  });

  describe('getContextSnapshot', () => {
    it('should return null for nonexistent entity', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const snapshot = await service.getContextSnapshot('nonexistent');

      expect(snapshot).toBeNull();
    });

    it('should return null for entity without source', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-4');
      mockDb.seed(entity);

      const snapshot = await service.getContextSnapshot(entity.id);

      expect(snapshot).toBeNull();
    });

    it('should return snapshot for linked entity', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-5');
      entity.source_platform = 'github';
      entity.source_record_id = 'user-007';
      entity.canonical_entity_id = 'canonical-999';
      entity.context_status = 'linked';
      entity.last_context_sync_at = '2026-04-01T12:00:00Z';
      mockDb.seed(entity);

      const snapshot = await service.getContextSnapshot(entity.id);

      expect(snapshot).not.toBeNull();
      expect(snapshot!.sourcePlatform).toBe('github');
      expect(snapshot!.sourceRecordId).toBe('user-007');
      expect(snapshot!.canonicalEntityId).toBe('canonical-999');
      expect(snapshot!.contextStatus).toBe('linked');
    });
  });

  // ── Asset deep linking ────────────────────────────────────────────────────

  const createMockAssets = (): AssetRegistryPort & {
    seedAsset(entry: AssetRegistryEntry): void;
    seedLink(link: AssetEvidenceLink): void;
  } => {
    const assetStore = new Map<string, AssetRegistryEntry>();
    const linkStore = new Map<string, AssetEvidenceLink>();

    return {
      seedAsset(entry) {
        assetStore.set(`${entry.kind}:${entry.refId}:${entry.domain}`, entry);
      },
      seedLink(link) {
        linkStore.set(link.id, link);
      },
      async getAssetByRef(kind, refId, domain) {
        return assetStore.get(`${kind}:${refId}:${domain}`) ?? null;
      },
      async registerAsset(input) {
        const entry: AssetRegistryEntry = {
          id: `asset-${crypto.randomUUID()}`,
          kind: input.kind,
          refId: input.refId,
          domain: input.domain,
          label: input.label,
          metadata: input.metadata ?? {},
          createdAt: new Date(),
        };
        assetStore.set(`${entry.kind}:${entry.refId}:${entry.domain}`, entry);
        return entry;
      },
      async linkAssets(input) {
        const link: AssetEvidenceLink = {
          id: `link-${crypto.randomUUID()}`,
          fromAssetId: input.fromAssetId,
          toAssetId: input.toAssetId,
          linkKind: input.linkKind,
          confidence: input.confidence ?? null,
          metadata: input.metadata ?? {},
          createdAt: new Date(),
        };
        linkStore.set(link.id, link);
        return link;
      },
      async getLinksFrom(assetId) {
        return [...linkStore.values()].filter((l) => l.fromAssetId === assetId);
      },
    };
  };

  describe('resolveAssetEntry', () => {
    it('should return null when no assets port is provided', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-ra-1');
      entity.canonical_entity_id = 'canonical-ra-1';
      mockDb.seed(entity);

      const result = await service.resolveAssetEntry(entity.id);
      expect(result).toBeNull();
    });

    it('should return null when entity has no canonical ID', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-ra-2');
      mockDb.seed(entity);

      const result = await service.resolveAssetEntry(entity.id);
      expect(result).toBeNull();
    });

    it('should return the matching asset entry when registered', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-ra-3');
      entity.canonical_entity_id = 'canonical-ra-3';
      mockDb.seed(entity);

      const seededAsset: AssetRegistryEntry = {
        id: 'asset-ra-3',
        kind: 'governance_entity',
        refId: 'canonical-ra-3',
        domain: 'charter',
        label: 'Test Gov Entity',
        metadata: {},
        createdAt: new Date(),
      };
      mockAssets.seedAsset(seededAsset);

      const result = await service.resolveAssetEntry(entity.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('asset-ra-3');
      expect(result!.kind).toBe('governance_entity');
      expect(result!.refId).toBe('canonical-ra-3');
    });
  });

  describe('ensureAssetRegistered', () => {
    it('should throw when no assets port is provided', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-ear-1');
      entity.canonical_entity_id = 'canonical-ear-1';
      mockDb.seed(entity);

      await expect(service.ensureAssetRegistered(entity.id, 'My Entity')).rejects.toThrow(
        'Asset registry port not provided',
      );
    });

    it('should throw when entity is not found', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      await expect(service.ensureAssetRegistered('nonexistent', 'My Entity')).rejects.toThrow(
        'Charter entity not found',
      );
    });

    it('should throw when entity has no canonical ID', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-ear-2');
      mockDb.seed(entity);

      await expect(service.ensureAssetRegistered(entity.id, 'My Entity')).rejects.toThrow('has no canonical ID');
    });

    it('should register a new asset when none exists', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-ear-3');
      entity.canonical_entity_id = 'canonical-ear-3';
      mockDb.seed(entity);

      const entry = await service.ensureAssetRegistered(entity.id, 'Governance Entity Label');

      expect(entry.kind).toBe('governance_entity');
      expect(entry.refId).toBe('canonical-ear-3');
      expect(entry.domain).toBe('charter');
      expect(entry.label).toBe('Governance Entity Label');
    });

    it('should return existing asset without creating duplicate', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-ear-4');
      entity.canonical_entity_id = 'canonical-ear-4';
      mockDb.seed(entity);

      const existing: AssetRegistryEntry = {
        id: 'asset-ear-existing',
        kind: 'governance_entity',
        refId: 'canonical-ear-4',
        domain: 'charter',
        label: 'Existing Label',
        metadata: {},
        createdAt: new Date(),
      };
      mockAssets.seedAsset(existing);

      const result = await service.ensureAssetRegistered(entity.id, 'New Label');

      expect(result.id).toBe('asset-ear-existing');
      expect(result.label).toBe('Existing Label');
    });
  });

  describe('linkEntityToAsset', () => {
    it('should throw when no assets port is provided', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-la-1');
      entity.canonical_entity_id = 'canonical-la-1';
      mockDb.seed(entity);

      await expect(service.linkEntityToAsset(entity.id, 'target-asset-1', 'references')).rejects.toThrow(
        'Asset registry port not provided',
      );
    });

    it('should throw when entity has no registered asset entry', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-la-2');
      entity.canonical_entity_id = 'canonical-la-2';
      mockDb.seed(entity);

      await expect(service.linkEntityToAsset(entity.id, 'target-asset-2', 'supports')).rejects.toThrow(
        'No asset entry found',
      );
    });

    it('should create an evidence link to a target asset', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-la-3');
      entity.canonical_entity_id = 'canonical-la-3';
      mockDb.seed(entity);

      const fromAsset: AssetRegistryEntry = {
        id: 'asset-la-from',
        kind: 'governance_entity',
        refId: 'canonical-la-3',
        domain: 'charter',
        label: 'From Entity',
        metadata: {},
        createdAt: new Date(),
      };
      mockAssets.seedAsset(fromAsset);

      const link = await service.linkEntityToAsset(entity.id, 'asset-la-target', 'supports', 0.9);

      expect(link.fromAssetId).toBe('asset-la-from');
      expect(link.toAssetId).toBe('asset-la-target');
      expect(link.linkKind).toBe('supports');
      expect(link.confidence).toBe(0.9);
    });
  });

  describe('getEntityAssetLinks', () => {
    it('should return empty array when no assets port is provided', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const service = createCharterEntityContextService(mockDb, mockGraph);

      const entity = createTestEntity('entity-gal-1');
      entity.canonical_entity_id = 'canonical-gal-1';
      mockDb.seed(entity);

      const links = await service.getEntityAssetLinks(entity.id);
      expect(links).toEqual([]);
    });

    it('should return empty array when entity has no asset entry', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-gal-2');
      entity.canonical_entity_id = 'canonical-gal-2';
      mockDb.seed(entity);

      const links = await service.getEntityAssetLinks(entity.id);
      expect(links).toEqual([]);
    });

    it('should return all outgoing links for an entity with registered asset', async () => {
      const mockDb = createMockDb();
      const mockGraph = createMockGraph();
      const mockAssets = createMockAssets();
      const service = createCharterEntityContextService(mockDb, mockGraph, mockAssets);

      const entity = createTestEntity('entity-gal-3');
      entity.canonical_entity_id = 'canonical-gal-3';
      mockDb.seed(entity);

      const fromAsset: AssetRegistryEntry = {
        id: 'asset-gal-from',
        kind: 'governance_entity',
        refId: 'canonical-gal-3',
        domain: 'charter',
        label: 'From Entity',
        metadata: {},
        createdAt: new Date(),
      };
      mockAssets.seedAsset(fromAsset);

      const existingLink: AssetEvidenceLink = {
        id: 'link-gal-1',
        fromAssetId: 'asset-gal-from',
        toAssetId: 'asset-gal-target',
        linkKind: 'derived_from',
        confidence: 0.8,
        metadata: {},
        createdAt: new Date(),
      };
      mockAssets.seedLink(existingLink);

      const links = await service.getEntityAssetLinks(entity.id);

      expect(links).toHaveLength(1);
      expect(links[0].fromAssetId).toBe('asset-gal-from');
      expect(links[0].toAssetId).toBe('asset-gal-target');
      expect(links[0].linkKind).toBe('derived_from');
    });
  });
});
