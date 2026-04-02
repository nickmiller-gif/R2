export type ActorKind = 'user' | 'service' | 'system';

export interface ProvenanceActor {
  id: string;
  kind: ActorKind;
}

export interface ProvenanceEvent {
  id: string;
  entityId: string;
  eventType: string;
  actor: ProvenanceActor;
  payloadHash: string;
  chainHash: string;
  metadata: Record<string, unknown>;
  recordedAt: Date;
}

export interface AppendProvenanceInput {
  entityId: string;
  eventType: string;
  actor: ProvenanceActor;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface ProvenanceLookupFilter {
  entityId?: string;
  actorId?: string;
  eventType?: string;
  fromDate?: Date;
  toDate?: Date;
}
