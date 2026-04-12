/**
 * MEG Entity — canonical identity node in the Master Entity Graph.
 *
 * Every real-world entity (person, org, property, product, concept, location, ip) gets
 * a single MEG node. Domain objects (Charter entities, Oracle theses,
 * Eigen chunks) reference MEG entities via meg_entity_id foreign keys,
 * giving the ecosystem a single canonical identity layer.
 */

export type MegEntityType =
  | 'person'
  | 'org'
  | 'property'
  | 'product'
  | 'concept'
  | 'location'
  | 'ip';

export type MegEntityStatus = 'active' | 'merged' | 'archived';

export interface MegEntity {
  id: string;
  profileId: string | null;
  entityType: MegEntityType;
  canonicalName: string;
  status: MegEntityStatus;
  mergedIntoId: string | null;
  externalIds: Record<string, string>;
  attributes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMegEntityInput {
  profileId?: string | null;
  entityType: MegEntityType;
  canonicalName: string;
  externalIds?: Record<string, string>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateMegEntityInput {
  canonicalName?: string;
  entityType?: MegEntityType;
  status?: MegEntityStatus;
  externalIds?: Record<string, string>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface MegEntityFilter {
  profileId?: string;
  entityType?: MegEntityType;
  status?: MegEntityStatus;
  canonicalNameLike?: string;
  limit?: number;
  offset?: number;
}
