/**
 * Tests for the MEG entity lookup port.
 */
import { describe, it, expect } from 'vitest';
import {
  createMegEntityLookup,
  type MegEntityLookupDeps,
} from '../../src/lib/identity/meg-lookup.js';

function makeMockDeps(): MegEntityLookupDeps & {
  entities: Array<{ id: string; entity_type: string; canonical_name: string; status: string }>;
  aliases: Array<{ meg_entity_id: string; alias_kind: string; alias_value: string; confidence: number }>;
} {
  const entities: Array<{ id: string; entity_type: string; canonical_name: string; status: string }> = [];
  const aliases: Array<{ meg_entity_id: string; alias_kind: string; alias_value: string; confidence: number }> = [];

  return {
    entities,
    aliases,
    async findEntityById(id) {
      return entities.find((e) => e.id === id) ?? null;
    },
    async findAliasesByValue(aliasValue) {
      return aliases.filter((a) => a.alias_value === aliasValue);
    },
  };
}

describe('MegEntityLookup', () => {
  it('getActiveEntity returns entity when active', async () => {
    const deps = makeMockDeps();
    deps.entities.push({ id: 'e1', entity_type: 'org', canonical_name: 'Acme Corp', status: 'active' });
    const lookup = createMegEntityLookup(deps);

    const entity = await lookup.getActiveEntity('e1');
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe('e1');
    expect(entity!.entityType).toBe('org');
    expect(entity!.canonicalName).toBe('Acme Corp');
    expect(entity!.status).toBe('active');
  });

  it('getActiveEntity returns null for merged entity', async () => {
    const deps = makeMockDeps();
    deps.entities.push({ id: 'e2', entity_type: 'person', canonical_name: 'Old Name', status: 'merged' });
    const lookup = createMegEntityLookup(deps);

    const entity = await lookup.getActiveEntity('e2');
    expect(entity).toBeNull();
  });

  it('getActiveEntity returns null for nonexistent entity', async () => {
    const deps = makeMockDeps();
    const lookup = createMegEntityLookup(deps);

    const entity = await lookup.getActiveEntity('nonexistent');
    expect(entity).toBeNull();
  });

  it('resolveByAlias returns matching aliases', async () => {
    const deps = makeMockDeps();
    deps.aliases.push(
      { meg_entity_id: 'e1', alias_kind: 'slug', alias_value: 'acme', confidence: 1.0 },
      { meg_entity_id: 'e3', alias_kind: 'external_id', alias_value: 'acme', confidence: 0.8 },
    );
    const lookup = createMegEntityLookup(deps);

    const hits = await lookup.resolveByAlias('acme');
    expect(hits).toHaveLength(2);
    expect(hits[0].megEntityId).toBe('e1');
    expect(hits[1].megEntityId).toBe('e3');
  });

  it('resolveByAlias returns empty array when no match', async () => {
    const deps = makeMockDeps();
    const lookup = createMegEntityLookup(deps);

    const hits = await lookup.resolveByAlias('no-match');
    expect(hits).toEqual([]);
  });

  it('isActive returns true for active entity', async () => {
    const deps = makeMockDeps();
    deps.entities.push({ id: 'e1', entity_type: 'property', canonical_name: 'HQ', status: 'active' });
    const lookup = createMegEntityLookup(deps);

    expect(await lookup.isActive('e1')).toBe(true);
  });

  it('isActive returns false for archived entity', async () => {
    const deps = makeMockDeps();
    deps.entities.push({ id: 'e1', entity_type: 'property', canonical_name: 'HQ', status: 'archived' });
    const lookup = createMegEntityLookup(deps);

    expect(await lookup.isActive('e1')).toBe(false);
  });

  it('isActive returns false for nonexistent entity', async () => {
    const deps = makeMockDeps();
    const lookup = createMegEntityLookup(deps);

    expect(await lookup.isActive('nope')).toBe(false);
  });
});
