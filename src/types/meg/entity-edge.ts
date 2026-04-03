/**
 * MEG Entity Edge — typed relationship between two MEG entities.
 *
 * Edges model the graph structure: ownership, employment, subsidiary,
 * partnership, location, and domain-specific relationships.
 * Each edge carries a confidence score and optional validity window.
 */

export type MegEdgeType =
  | 'owns'
  | 'employs'
  | 'subsidiary_of'
  | 'partner_of'
  | 'located_at'
  | 'related_to'
  | 'derived_from'
  | 'supersedes';

export interface MegEntityEdge {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  edgeType: MegEdgeType;
  confidence: number;
  validFrom: Date | null;
  validTo: Date | null;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMegEntityEdgeInput {
  sourceEntityId: string;
  targetEntityId: string;
  edgeType: MegEdgeType;
  confidence?: number;
  validFrom?: string | null;
  validTo?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateMegEntityEdgeInput {
  confidence?: number;
  validFrom?: string | null;
  validTo?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MegEntityEdgeFilter {
  sourceEntityId?: string;
  targetEntityId?: string;
  edgeType?: MegEdgeType;
  eitherEntityId?: string;
}
