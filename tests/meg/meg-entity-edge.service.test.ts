/**
 * Tests for the MEG entity edge service.
 */
import { describe, it, expect } from 'vitest';
import {
  createMegEntityEdgeService,
  type MegEntityEdgeDb,
  type DbMegEntityEdgeRow,
} from '../../src/services/meg/meg-entity-edge.service.js';
import type { MegEntityEdgeFilter } from '../../src/types/meg/entity-edge.js';

function makeMockDb(): MegEntityEdgeDb & { rows: DbMegEntityEdgeRow[] } {
  const rows: DbMegEntityEdgeRow[] = [];
  return {
    rows,
    async insertEdge(row) {
      rows.push(row);
      return row;
    },
    async findEdgeById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryEdges(filter?: MegEntityEdgeFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.sourceEntityId && r.source_entity_id !== filter.sourceEntityId) return false;
        if (filter.targetEntityId && r.target_entity_id !== filter.targetEntityId) return false;
        if (filter.edgeType && r.edge_type !== filter.edgeType) return false;
        return true;
      });
    },
    async updateEdge(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Edge not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
    async deleteEdge(id) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx !== -1) rows.splice(idx, 1);
    },
  };
}

describe('MegEntityEdgeService', () => {
  it('creates edge with default confidence and null optional fields', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const edge = await service.create({
      sourceEntityId: 'entity-1',
      targetEntityId: 'entity-2',
      edgeType: 'owns',
    });

    expect(edge.sourceEntityId).toBe('entity-1');
    expect(edge.targetEntityId).toBe('entity-2');
    expect(edge.edgeType).toBe('owns');
    expect(edge.confidence).toBe(100);
    expect(edge.validFrom).toBeNull();
    expect(edge.validTo).toBeNull();
    expect(edge.source).toBeNull();
    expect(edge.metadata).toEqual({});
    expect(edge.createdAt).toBeInstanceOf(Date);
    expect(edge.updatedAt).toBeInstanceOf(Date);
  });

  it('creates edge with all optional fields set', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const edge = await service.create({
      sourceEntityId: 'entity-3',
      targetEntityId: 'entity-4',
      edgeType: 'employs',
      confidence: 80,
      validFrom: '2024-01-01T00:00:00.000Z',
      validTo: '2025-01-01T00:00:00.000Z',
      source: 'hr-system',
      metadata: { role: 'engineer' },
    });

    expect(edge.confidence).toBe(80);
    expect(edge.validFrom).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    expect(edge.validTo).toEqual(new Date('2025-01-01T00:00:00.000Z'));
    expect(edge.source).toBe('hr-system');
    expect(edge.metadata).toEqual({ role: 'engineer' });
  });

  it('returns null for nonexistent edge', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves edge by id with all fields', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const created = await service.create({
      sourceEntityId: 'entity-A',
      targetEntityId: 'entity-B',
      edgeType: 'subsidiary_of',
      confidence: 95,
    });

    const retrieved = await service.getById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.edgeType).toBe('subsidiary_of');
    expect(retrieved!.confidence).toBe(95);
  });

  it('lists all edges when no filter provided', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    await service.create({ sourceEntityId: 'e-1', targetEntityId: 'e-2', edgeType: 'owns' });
    await service.create({ sourceEntityId: 'e-3', targetEntityId: 'e-4', edgeType: 'partner_of' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('lists edges filtered by sourceEntityId', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    await service.create({ sourceEntityId: 'e-1', targetEntityId: 'e-2', edgeType: 'owns' });
    await service.create({ sourceEntityId: 'e-1', targetEntityId: 'e-3', edgeType: 'employs' });
    await service.create({ sourceEntityId: 'e-4', targetEntityId: 'e-2', edgeType: 'owns' });

    const fromE1 = await service.list({ sourceEntityId: 'e-1' });
    expect(fromE1).toHaveLength(2);
    expect(fromE1.every((e) => e.sourceEntityId === 'e-1')).toBe(true);
  });

  it('lists edges filtered by edgeType', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    await service.create({ sourceEntityId: 'e-1', targetEntityId: 'e-2', edgeType: 'owns' });
    await service.create({ sourceEntityId: 'e-3', targetEntityId: 'e-4', edgeType: 'owns' });
    await service.create({ sourceEntityId: 'e-5', targetEntityId: 'e-6', edgeType: 'located_at' });

    const ownership = await service.list({ edgeType: 'owns' });
    expect(ownership).toHaveLength(2);
    expect(ownership.every((e) => e.edgeType === 'owns')).toBe(true);
  });

  it('updates edge fields', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const edge = await service.create({
      sourceEntityId: 'e-1',
      targetEntityId: 'e-2',
      edgeType: 'partner_of',
      confidence: 70,
    });

    const updated = await service.update(edge.id, {
      confidence: 90,
      metadata: { verified: true },
    });

    expect(updated.confidence).toBe(90);
    expect(updated.metadata).toEqual({ verified: true });
  });

  it('updates validity window', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const edge = await service.create({
      sourceEntityId: 'e-1',
      targetEntityId: 'e-2',
      edgeType: 'employs',
    });

    expect(edge.validFrom).toBeNull();
    expect(edge.validTo).toBeNull();

    const updated = await service.update(edge.id, {
      validFrom: '2025-01-01T00:00:00.000Z',
      validTo: '2026-01-01T00:00:00.000Z',
    });

    expect(updated.validFrom).toEqual(new Date('2025-01-01T00:00:00.000Z'));
    expect(updated.validTo).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('deleteById removes the edge', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const edge = await service.create({
      sourceEntityId: 'e-1',
      targetEntityId: 'e-2',
      edgeType: 'related_to',
    });

    await service.deleteById(edge.id);

    const all = await service.list();
    expect(all).toHaveLength(0);

    const retrieved = await service.getById(edge.id);
    expect(retrieved).toBeNull();
  });

  it('assigns a unique id to each edge', async () => {
    const db = makeMockDb();
    const service = createMegEntityEdgeService(db);

    const e1 = await service.create({ sourceEntityId: 'e-1', targetEntityId: 'e-2', edgeType: 'owns' });
    const e2 = await service.create({ sourceEntityId: 'e-3', targetEntityId: 'e-4', edgeType: 'employs' });

    expect(e1.id).not.toBe(e2.id);
  });
});
