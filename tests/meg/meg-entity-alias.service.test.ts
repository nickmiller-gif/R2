/**
 * Tests for the MEG entity alias service.
 */
import { describe, it, expect } from 'vitest';
import {
  createMegEntityAliasService,
  type MegEntityAliasDb,
  type DbMegEntityAliasRow,
} from '../../src/services/meg/meg-entity-alias.service.js';
import type { MegEntityAliasFilter } from '../../src/types/meg/entity-alias.js';

function makeMockDb(): MegEntityAliasDb & { rows: DbMegEntityAliasRow[] } {
  const rows: DbMegEntityAliasRow[] = [];
  return {
    rows,
    async insertAlias(row) {
      rows.push(row);
      return row;
    },
    async findAliasById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryAliases(filter?: MegEntityAliasFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.megEntityId && r.meg_entity_id !== filter.megEntityId) return false;
        if (filter.aliasKind && r.alias_kind !== filter.aliasKind) return false;
        if (filter.aliasValue && r.alias_value !== filter.aliasValue) return false;
        return true;
      });
    },
    async findByValue(aliasValue) {
      return rows.filter((r) => r.alias_value === aliasValue);
    },
    async deleteAlias(id) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx !== -1) rows.splice(idx, 1);
    },
  };
}

describe('MegEntityAliasService', () => {
  it('creates alias with default confidence and null source', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const alias = await service.create({
      megEntityId: 'entity-1',
      aliasKind: 'slug',
      aliasValue: 'acme-corp',
    });

    expect(alias.megEntityId).toBe('entity-1');
    expect(alias.aliasKind).toBe('slug');
    expect(alias.aliasValue).toBe('acme-corp');
    expect(alias.confidence).toBe(100);
    expect(alias.source).toBeNull();
    expect(alias.metadata).toEqual({});
    expect(alias.createdAt).toBeInstanceOf(Date);
  });

  it('creates alias with all optional fields set', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const alias = await service.create({
      megEntityId: 'entity-2',
      aliasKind: 'external_id',
      aliasValue: 'EXT-007',
      source: 'crm-system',
      confidence: 85,
      metadata: { verified: true },
    });

    expect(alias.source).toBe('crm-system');
    expect(alias.confidence).toBe(85);
    expect(alias.metadata).toEqual({ verified: true });
  });

  it('returns null for nonexistent alias', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves alias by id with all fields', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const created = await service.create({
      megEntityId: 'entity-3',
      aliasKind: 'legal_name',
      aliasValue: 'Acme Corporation LLC',
      confidence: 100,
    });

    const retrieved = await service.getById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.aliasKind).toBe('legal_name');
    expect(retrieved!.aliasValue).toBe('Acme Corporation LLC');
  });

  it('lists all aliases when no filter provided', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    await service.create({ megEntityId: 'entity-1', aliasKind: 'slug', aliasValue: 'slug-a' });
    await service.create({ megEntityId: 'entity-2', aliasKind: 'external_id', aliasValue: 'EXT-1' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('lists aliases filtered by megEntityId', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    await service.create({ megEntityId: 'entity-A', aliasKind: 'slug', aliasValue: 'slug-a' });
    await service.create({ megEntityId: 'entity-A', aliasKind: 'dba', aliasValue: 'Alpha Co' });
    await service.create({ megEntityId: 'entity-B', aliasKind: 'slug', aliasValue: 'slug-b' });

    const entityAliases = await service.list({ megEntityId: 'entity-A' });
    expect(entityAliases).toHaveLength(2);
    expect(entityAliases.every((a) => a.megEntityId === 'entity-A')).toBe(true);
  });

  it('lists aliases filtered by aliasKind', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    await service.create({ megEntityId: 'entity-1', aliasKind: 'slug', aliasValue: 'slug-1' });
    await service.create({ megEntityId: 'entity-2', aliasKind: 'slug', aliasValue: 'slug-2' });
    await service.create({ megEntityId: 'entity-3', aliasKind: 'external_id', aliasValue: 'EXT-3' });

    const slugs = await service.list({ aliasKind: 'slug' });
    expect(slugs).toHaveLength(2);
    expect(slugs.every((a) => a.aliasKind === 'slug')).toBe(true);
  });

  it('resolve finds aliases by value across entities', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    await service.create({ megEntityId: 'entity-1', aliasKind: 'slug', aliasValue: 'shared-name' });
    await service.create({ megEntityId: 'entity-2', aliasKind: 'dba', aliasValue: 'shared-name' });
    await service.create({ megEntityId: 'entity-3', aliasKind: 'slug', aliasValue: 'other-name' });

    const resolved = await service.resolve('shared-name');
    expect(resolved).toHaveLength(2);
    expect(resolved.every((a) => a.aliasValue === 'shared-name')).toBe(true);
  });

  it('resolve returns empty array when no match found', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const result = await service.resolve('nonexistent-value');
    expect(result).toEqual([]);
  });

  it('deleteById removes the alias', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const alias = await service.create({
      megEntityId: 'entity-1',
      aliasKind: 'shortcode',
      aliasValue: 'ACME',
    });

    await service.deleteById(alias.id);

    const all = await service.list();
    expect(all).toHaveLength(0);

    const retrieved = await service.getById(alias.id);
    expect(retrieved).toBeNull();
  });

  it('assigns a unique id to each alias', async () => {
    const db = makeMockDb();
    const service = createMegEntityAliasService(db);

    const a1 = await service.create({ megEntityId: 'entity-1', aliasKind: 'slug', aliasValue: 'slug-1' });
    const a2 = await service.create({ megEntityId: 'entity-1', aliasKind: 'dba', aliasValue: 'DBA Name' });

    expect(a1.id).not.toBe(a2.id);
  });
});
