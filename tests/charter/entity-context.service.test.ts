import { describe, it, expect } from 'vitest';
import {
  createCharterEntityContextService,
  type CharterEntityContextService,
  type EntityContextDb,
  type EntityGraphLookup,
  type DbCharterEntityRow,
} from '../../src/services/charter/entity-context.service.js';

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
});
