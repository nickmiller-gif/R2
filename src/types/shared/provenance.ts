/**
 * Domain-agnostic provenance types.
 *
 * Moved from types/charter/provenance.ts to be shared across all domains.
 * Charter, Oracle, and Eigen all use the same immutable provenance chain.
 */

export type ActorKind = 'user' | 'service' | 'system';

export interface ProvenanceActor {
  id: string;
  kind: ActorKind;
}

export interface ProvenanceEvent {
  id: string;
  /** The domain that owns this provenance stream (e.g., 'charter', 'oracle'). */
  domain: string;
  entityId: string;
  eventType: string;
  actor: ProvenanceActor;
  payloadHash: string;
  chainHash: string;
  metadata: Record<string, unknown>;
  recordedAt: Date;
}

export interface AppendProvenanceInput {
  /** Domain tag — ensures provenance streams are scoped per domain. */
  domain: string;
  entityId: string;
  eventType: string;
  actor: ProvenanceActor;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface ProvenanceLookupFilter {
  domain?: string;
  entityId?: string;
  actorId?: string;
  eventType?: string;
  fromDate?: Date;
  toDate?: Date;
}
