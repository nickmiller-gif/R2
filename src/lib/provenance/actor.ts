import type { ActorKind, ProvenanceActor } from '../../types/charter/provenance.js';

export interface MegIdentity {
  id: string;
  kind?: string;
}

/**
 * Normalizes a MEG identity into the canonical ProvenanceActor shape.
 * Defaults to 'user' if no kind is provided or kind is unrecognized.
 */
export function normalizeActor(identity: MegIdentity): ProvenanceActor {
  return {
    id: identity.id,
    kind: resolveActorKind(identity.kind),
  };
}

function resolveActorKind(kind: string | undefined): ActorKind {
  const known: ActorKind[] = ['user', 'service', 'system'];
  return known.includes(kind as ActorKind) ? (kind as ActorKind) : 'user';
}
