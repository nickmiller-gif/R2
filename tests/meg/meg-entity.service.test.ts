/**
 * Tests for the MEG entity service.
 */
import { describe, it, expect } from 'vitest';
import {
  createMegEntityService,
  type MegEntityDb,
  type DbMegEntityRow,
} from '../../src/services/meg/meg-entity.service.js';
import type { MegEntityFilter } from '../../src/types/meg/entity.js';

function makeMockDb(): MegEntityDb & { rows: DbMegEntityRow[] } {
  const rows: DbMegEntityRow[] = [];
  return {
    rows,
    async insertEntity(row) {
      rows.push(row);
      return row;
    },
    async findEntityById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryEntities(filter?: MegEntityFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.profileId && r.profile_id !== filter.profileId) return false;
        if (filter.entityType && r.entity_type !== filter.entityType) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateEntity(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Entity not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('MegEntityService', () => {
  it('creates entity with active status and empty defaults', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const entity = await service.create({
      entityType: 'org',
      canonicalName: 'Acme Corp',
    });

    expect(entity.entityType).toBe('org');
    expect(entity.canonicalName).toBe('Acme Corp');
    expect(entity.status).toBe('active');
    expect(entity.profileId).toBeNull();
    expect(entity.mergedIntoId).toBeNull();
    expect(entity.externalIds).toEqual({});
    expect(entity.attributes).toEqual({});
    expect(entity.metadata).toEqual({});
    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
  });

  it('creates entity with all optional fields set', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const entity = await service.create({
      profileId: 'profile-1',
      entityType: 'person',
      canonicalName: 'Jane Smith',
      externalIds: { linkedin: 'janesmith' },
      attributes: { industry: 'fintech' },
      metadata: { source: 'manual' },
    });

    expect(entity.profileId).toBe('profile-1');
    expect(entity.externalIds).toEqual({ linkedin: 'janesmith' });
    expect(entity.attributes).toEqual({ industry: 'fintech' });
    expect(entity.metadata).toEqual({ source: 'manual' });
  });

  it('returns null for nonexistent entity', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves entity by id with all fields', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const created = await service.create({
      entityType: 'product',
      canonicalName: 'WidgetPro',
      externalIds: { sku: 'WP-001' },
    });

    const retrieved = await service.getById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.entityType).toBe('product');
    expect(retrieved!.canonicalName).toBe('WidgetPro');
    expect(retrieved!.externalIds).toEqual({ sku: 'WP-001' });
  });

  it('lists all entities when no filter provided', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    await service.create({ entityType: 'org', canonicalName: 'Org A' });
    await service.create({ entityType: 'person', canonicalName: 'Person B' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('lists entities filtered by entityType', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    await service.create({ entityType: 'org', canonicalName: 'Corp X' });
    await service.create({ entityType: 'org', canonicalName: 'Corp Y' });
    await service.create({ entityType: 'person', canonicalName: 'Person Z' });

    const orgs = await service.list({ entityType: 'org' });
    expect(orgs).toHaveLength(2);
    expect(orgs.every((e) => e.entityType === 'org')).toBe(true);
  });

  it('lists entities filtered by status', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const e1 = await service.create({ entityType: 'org', canonicalName: 'Active Org' });
    const e2 = await service.create({ entityType: 'org', canonicalName: 'To Archive' });

    await service.archive(e2.id);

    const active = await service.list({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(e1.id);

    const archived = await service.list({ status: 'archived' });
    expect(archived).toHaveLength(1);
    expect(archived[0].id).toBe(e2.id);
  });

  it('updates entity fields', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const entity = await service.create({
      entityType: 'org',
      canonicalName: 'Old Name',
    });

    const updated = await service.update(entity.id, {
      canonicalName: 'New Name',
      attributes: { size: 'large' },
    });

    expect(updated.canonicalName).toBe('New Name');
    expect(updated.attributes).toEqual({ size: 'large' });
    expect(updated.entityType).toBe('org');
  });

  it('merge sets source status to merged and points to target', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const source = await service.create({ entityType: 'org', canonicalName: 'Old Corp' });
    const target = await service.create({ entityType: 'org', canonicalName: 'New Corp' });

    expect(source.status).toBe('active');
    expect(source.mergedIntoId).toBeNull();

    const merged = await service.merge(source.id, target.id);

    expect(merged.status).toBe('merged');
    expect(merged.mergedIntoId).toBe(target.id);
  });

  it('archive sets status to archived', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const entity = await service.create({ entityType: 'concept', canonicalName: 'Old Concept' });

    expect(entity.status).toBe('active');

    const archived = await service.archive(entity.id);
    expect(archived.status).toBe('archived');
  });

  it('assigns a unique id to each entity', async () => {
    const db = makeMockDb();
    const service = createMegEntityService(db);

    const e1 = await service.create({ entityType: 'org', canonicalName: 'Org 1' });
    const e2 = await service.create({ entityType: 'org', canonicalName: 'Org 2' });

    expect(e1.id).not.toBe(e2.id);
  });
});
