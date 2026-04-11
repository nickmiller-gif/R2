/**
 * MEG Cross-Domain Resolver — the identity handshake contract.
 *
 * Provides a single resolution surface that any R2 domain (Charter, Oracle, Eigen)
 * can use to resolve, validate, and traverse MEG entities. Each domain gets a typed
 * port interface that delegates to this resolver.
 *
 * This is the contract that prevents "skipped outbox" and cross-domain identity drift:
 * every domain asks MEG the same way, through the same contract.
 */

import type { MegEntityType, MegEntityStatus } from '../../types/meg/entity.js';
import type { MegEdgeType } from '../../types/meg/entity-edge.js';
import type { MegEntityLookup, MegEntityRef } from './meg-lookup.js';

// ---------------------------------------------------------------------------
// Related-entity view (entity + the edge that connects it)
// ---------------------------------------------------------------------------

export interface MegRelatedEntity {
  entity: MegEntityRef;
  edgeType: MegEdgeType;
  direction: 'outgoing' | 'incoming';
  confidence: number;
}

// ---------------------------------------------------------------------------
// Cross-domain resolver interface
// ---------------------------------------------------------------------------

export interface MegCrossDomainResolver {
  /** Validate and return a MEG entity. Delegates to MegEntityLookup. */
  resolve(id: string): Promise<MegEntityRef | null>;

  /** Resolve by any alias value. Returns the best match (highest confidence), or null. */
  resolveByAlias(aliasValue: string): Promise<MegEntityRef | null>;

  /** Get related entities by edge type (or all edges if edgeType omitted). */
  getRelated(id: string, edgeType?: MegEdgeType): Promise<MegRelatedEntity[]>;

  /** Batch validate — returns only the IDs that are active MEG entities. */
  validateBatch(ids: string[]): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Dependencies — intentionally narrow so implementations stay swappable
// ---------------------------------------------------------------------------

export interface MegCrossDomainResolverDeps {
  lookup: MegEntityLookup;
  findEdgesByEntity(entityId: string, edgeType?: MegEdgeType): Promise<
    Array<{
      source_entity_id: string;
      target_entity_id: string;
      edge_type: string;
      confidence: number;
    }>
  >;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMegCrossDomainResolver(
  deps: MegCrossDomainResolverDeps,
): MegCrossDomainResolver {
  return {
    async resolve(id) {
      return deps.lookup.getActiveEntity(id);
    },

    async resolveByAlias(aliasValue) {
      const hits = await deps.lookup.resolveByAlias(aliasValue);
      if (hits.length === 0) return null;

      // Pick highest-confidence hit, then validate the entity is active.
      const sorted = [...hits].sort((a, b) => b.confidence - a.confidence);
      for (const hit of sorted) {
        const entity = await deps.lookup.getActiveEntity(hit.megEntityId);
        if (entity) return entity;
      }
      return null;
    },

    async getRelated(id, edgeType?) {
      const edges = await deps.findEdgesByEntity(id, edgeType);
      const related: MegRelatedEntity[] = [];

      for (const edge of edges) {
        const direction = edge.source_entity_id === id ? 'outgoing' : 'incoming';
        const otherId = direction === 'outgoing' ? edge.target_entity_id : edge.source_entity_id;
        const entity = await deps.lookup.getActiveEntity(otherId);
        if (entity) {
          related.push({
            entity,
            edgeType: edge.edge_type as MegEdgeType,
            direction,
            confidence: edge.confidence,
          });
        }
      }

      return related;
    },

    async validateBatch(ids) {
      const results = await Promise.all(ids.map((id) => deps.lookup.isActive(id)));
      return ids.filter((_, i) => results[i]);
    },
  };
}

// ---------------------------------------------------------------------------
// Domain-specific port types — typed convenience aliases
// ---------------------------------------------------------------------------

/** Port for Oracle to resolve the MEG entity a thesis is about. */
export interface OracleMegPort {
  /** Validate that a MEG entity is active before linking a thesis. */
  validateEntity(megEntityId: string): Promise<MegEntityRef | null>;
  /** Find related entities (e.g., subsidiaries of an org). */
  getRelated(megEntityId: string, edgeType?: MegEdgeType): Promise<MegRelatedEntity[]>;
}

/** Port for Eigen to resolve MEG entities referenced in knowledge chunks. */
export interface EigenMegPort {
  /** Validate that all entity IDs in a chunk are real MEG entities. */
  validateEntityIds(ids: string[]): Promise<string[]>;
  /** Resolve a single entity for display/enrichment. */
  resolve(megEntityId: string): Promise<MegEntityRef | null>;
}

/** Port for Charter (extends existing EntityGraphLookup pattern). */
export interface CharterMegPort {
  /** Resolve canonical ID from external source. */
  resolveByAlias(aliasValue: string): Promise<MegEntityRef | null>;
  /** Validate entity is active for governance binding. */
  validateEntity(megEntityId: string): Promise<MegEntityRef | null>;
}

/** Create domain-specific ports from a shared resolver. */
export function createDomainPorts(resolver: MegCrossDomainResolver): {
  oracle: OracleMegPort;
  eigen: EigenMegPort;
  charter: CharterMegPort;
} {
  return {
    oracle: {
      validateEntity: (id) => resolver.resolve(id),
      getRelated: (id, edgeType?) => resolver.getRelated(id, edgeType),
    },
    eigen: {
      validateEntityIds: (ids) => resolver.validateBatch(ids),
      resolve: (id) => resolver.resolve(id),
    },
    charter: {
      resolveByAlias: (aliasValue) => resolver.resolveByAlias(aliasValue),
      validateEntity: (id) => resolver.resolve(id),
    },
  };
}
