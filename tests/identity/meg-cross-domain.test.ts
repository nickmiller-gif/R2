/**
 * Tests for the MEG Cross-Domain Resolver and domain-specific ports.
 */
import { describe, it, expect } from 'vitest';
import {
  createMegCrossDomainResolver,
  createDomainPorts,
  type MegCrossDomainResolverDeps,
} from '../../src/lib/identity/meg-cross-domain.js';
import type { MegEntityLookup } from '../../src/lib/identity/meg-lookup.js';
import type { MegEdgeType } from '../../src/types/meg/entity-edge.js';

type EdgeRow = {
  source_entity_id: string;
  target_entity_id: string;
  edge_type: string;
  confidence: number;
};

function makeMockDeps(): MegCrossDomainResolverDeps & {
  entities: Map<string, { id: string; entityType: string; canonicalName: string; status: string }>;
  aliases: Array<{ megEntityId: string; aliasKind: string; aliasValue: string; confidence: number }>;
  edges: EdgeRow[];
} {
  const entities = new Map<string, { id: string; entityType: string; canonicalName: string; status: string }>();
  const aliases: Array<{ megEntityId: string; aliasKind: string; aliasValue: string; confidence: number }> = [];
  const edges: EdgeRow[] = [];

  const lookup: MegEntityLookup = {
    async getActiveEntity(id) {
      const e = entities.get(id);
      if (!e || e.status !== 'active') return null;
      return { id: e.id, entityType: e.entityType as any, canonicalName: e.canonicalName, status: e.status as any };
    },
    async resolveByAlias(aliasValue) {
      return aliases
        .filter((a) => a.aliasValue === aliasValue)
        .map((a) => ({
          megEntityId: a.megEntityId,
          aliasKind: a.aliasKind,
          aliasValue: a.aliasValue,
          confidence: a.confidence,
        }));
    },
    async isActive(id) {
      const e = entities.get(id);
      return e !== undefined && e.status === 'active';
    },
  };

  return {
    entities,
    aliases,
    edges,
    lookup,
    async findEdgesByEntity(entityId, edgeType?) {
      return edges.filter((e) => {
        const match = e.source_entity_id === entityId || e.target_entity_id === entityId;
        if (!match) return false;
        if (edgeType && e.edge_type !== edgeType) return false;
        return true;
      });
    },
  };
}

describe('MegCrossDomainResolver', () => {
  it('resolve returns active entity', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'org', canonicalName: 'Acme', status: 'active' });
    const resolver = createMegCrossDomainResolver(deps);

    const result = await resolver.resolve('e1');
    expect(result).not.toBeNull();
    expect(result!.canonicalName).toBe('Acme');
  });

  it('resolve returns null for merged entity', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'org', canonicalName: 'Old', status: 'merged' });
    const resolver = createMegCrossDomainResolver(deps);

    expect(await resolver.resolve('e1')).toBeNull();
  });

  it('resolveByAlias picks highest-confidence active entity', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'org', canonicalName: 'Acme', status: 'active' });
    deps.entities.set('e2', { id: 'e2', entityType: 'org', canonicalName: 'Acme Old', status: 'merged' });
    deps.aliases.push(
      { megEntityId: 'e2', aliasKind: 'slug', aliasValue: 'acme', confidence: 0.95 },
      { megEntityId: 'e1', aliasKind: 'slug', aliasValue: 'acme', confidence: 0.8 },
    );
    const resolver = createMegCrossDomainResolver(deps);

    // e2 has higher confidence but is merged, so e1 should be returned
    const result = await resolver.resolveByAlias('acme');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('e1');
  });

  it('resolveByAlias returns null when no active match', async () => {
    const deps = makeMockDeps();
    deps.aliases.push({ megEntityId: 'gone', aliasKind: 'slug', aliasValue: 'nope', confidence: 1 });
    const resolver = createMegCrossDomainResolver(deps);

    expect(await resolver.resolveByAlias('nope')).toBeNull();
  });

  it('getRelated returns outgoing and incoming edges', async () => {
    const deps = makeMockDeps();
    deps.entities.set('parent', { id: 'parent', entityType: 'org', canonicalName: 'Parent Co', status: 'active' });
    deps.entities.set('child', { id: 'child', entityType: 'org', canonicalName: 'Child Co', status: 'active' });
    deps.entities.set('partner', { id: 'partner', entityType: 'org', canonicalName: 'Partner Co', status: 'active' });
    deps.edges.push(
      { source_entity_id: 'parent', target_entity_id: 'child', edge_type: 'subsidiary_of', confidence: 0.9 },
      { source_entity_id: 'partner', target_entity_id: 'parent', edge_type: 'partner_of', confidence: 0.7 },
    );
    const resolver = createMegCrossDomainResolver(deps);

    const related = await resolver.getRelated('parent');
    expect(related).toHaveLength(2);

    const subsidiary = related.find((r) => r.entity.id === 'child');
    expect(subsidiary).toBeDefined();
    expect(subsidiary!.direction).toBe('outgoing');
    expect(subsidiary!.edgeType).toBe('subsidiary_of');

    const partner = related.find((r) => r.entity.id === 'partner');
    expect(partner).toBeDefined();
    expect(partner!.direction).toBe('incoming');
  });

  it('getRelated filters by edge type', async () => {
    const deps = makeMockDeps();
    deps.entities.set('a', { id: 'a', entityType: 'org', canonicalName: 'A', status: 'active' });
    deps.entities.set('b', { id: 'b', entityType: 'org', canonicalName: 'B', status: 'active' });
    deps.entities.set('c', { id: 'c', entityType: 'person', canonicalName: 'C', status: 'active' });
    deps.edges.push(
      { source_entity_id: 'a', target_entity_id: 'b', edge_type: 'subsidiary_of', confidence: 0.9 },
      { source_entity_id: 'a', target_entity_id: 'c', edge_type: 'employs', confidence: 0.8 },
    );
    const resolver = createMegCrossDomainResolver(deps);

    const subs = await resolver.getRelated('a', 'subsidiary_of');
    expect(subs).toHaveLength(1);
    expect(subs[0].entity.id).toBe('b');
  });

  it('getRelated skips inactive related entities', async () => {
    const deps = makeMockDeps();
    deps.entities.set('a', { id: 'a', entityType: 'org', canonicalName: 'A', status: 'active' });
    deps.entities.set('b', { id: 'b', entityType: 'org', canonicalName: 'B', status: 'archived' });
    deps.edges.push(
      { source_entity_id: 'a', target_entity_id: 'b', edge_type: 'owns', confidence: 1 },
    );
    const resolver = createMegCrossDomainResolver(deps);

    const related = await resolver.getRelated('a');
    expect(related).toHaveLength(0);
  });

  it('validateBatch returns only active IDs', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'org', canonicalName: 'A', status: 'active' });
    deps.entities.set('e2', { id: 'e2', entityType: 'person', canonicalName: 'B', status: 'merged' });
    deps.entities.set('e3', { id: 'e3', entityType: 'property', canonicalName: 'C', status: 'active' });
    const resolver = createMegCrossDomainResolver(deps);

    const valid = await resolver.validateBatch(['e1', 'e2', 'e3', 'nonexistent']);
    expect(valid).toEqual(['e1', 'e3']);
  });
});

describe('Domain Ports', () => {
  it('oracle port validates entity and gets related', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'org', canonicalName: 'Corp', status: 'active' });
    const resolver = createMegCrossDomainResolver(deps);
    const { oracle } = createDomainPorts(resolver);

    const entity = await oracle.validateEntity('e1');
    expect(entity).not.toBeNull();
    expect(entity!.canonicalName).toBe('Corp');
  });

  it('eigen port validates batch of entity IDs', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'org', canonicalName: 'A', status: 'active' });
    deps.entities.set('e2', { id: 'e2', entityType: 'org', canonicalName: 'B', status: 'archived' });
    const resolver = createMegCrossDomainResolver(deps);
    const { eigen } = createDomainPorts(resolver);

    const valid = await eigen.validateEntityIds(['e1', 'e2']);
    expect(valid).toEqual(['e1']);
  });

  it('charter port resolves by alias', async () => {
    const deps = makeMockDeps();
    deps.entities.set('e1', { id: 'e1', entityType: 'property', canonicalName: 'HQ', status: 'active' });
    deps.aliases.push({ megEntityId: 'e1', aliasKind: 'slug', aliasValue: 'headquarters', confidence: 1 });
    const resolver = createMegCrossDomainResolver(deps);
    const { charter } = createDomainPorts(resolver);

    const result = await charter.resolveByAlias('headquarters');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('e1');
  });
});
