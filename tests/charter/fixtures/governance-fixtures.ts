import type { GovernanceEntity, GovernanceTransition, CreateGovernanceEntityInput } from '../../../src/types/charter/governance.js';
import type { ProvenanceEvent, AppendProvenanceInput } from '../../../src/types/charter/provenance.js';
import type { AuditLogEntry } from '../../../src/types/charter/audit.js';

let counter = 0;
function nextId(): string {
  return `test-id-${++counter}`;
}

export function makeCreateEntityInput(overrides?: Partial<CreateGovernanceEntityInput>): CreateGovernanceEntityInput {
  return {
    kind: 'policy',
    refCode: `POL-${nextId()}`,
    title: 'Test Policy',
    body: 'Test policy body content',
    createdBy: 'user-actor-1',
    ...overrides,
  };
}

export function makeGovernanceEntity(overrides?: Partial<GovernanceEntity>): GovernanceEntity {
  const id = nextId();
  return {
    id,
    kind: 'policy',
    status: 'draft',
    refCode: `POL-${id}`,
    title: 'Test Policy',
    body: 'Test policy body',
    version: 1,
    parentId: null,
    createdBy: 'user-actor-1',
    createdAt: new Date('2026-04-02T00:00:00Z'),
    updatedAt: new Date('2026-04-02T00:00:00Z'),
    ...overrides,
  };
}

export function makeGovernanceTransition(overrides?: Partial<GovernanceTransition>): GovernanceTransition {
  return {
    id: nextId(),
    entityId: nextId(),
    fromStatus: 'draft',
    toStatus: 'active',
    reason: 'Approved by governance council',
    actorId: 'user-actor-1',
    transitionedAt: new Date('2026-04-02T01:00:00Z'),
    ...overrides,
  };
}

export function makeAppendProvenanceInput(entityId: string, overrides?: Partial<AppendProvenanceInput>): AppendProvenanceInput {
  return {
    domain: 'charter',
    entityId,
    eventType: 'entity.created',
    actor: { id: 'user-actor-1', kind: 'user' },
    payload: { ref: 'POL-001', version: 1 },
    metadata: {},
    ...overrides,
  };
}

export function makeProvenanceEvent(overrides?: Partial<ProvenanceEvent>): ProvenanceEvent {
  const id = nextId();
  return {
    id,
    domain: 'charter',
    entityId: nextId(),
    eventType: 'entity.created',
    actor: { id: 'user-actor-1', kind: 'user' },
    payloadHash: 'abc123',
    chainHash: 'def456',
    metadata: {},
    recordedAt: new Date('2026-04-02T00:00:00Z'),
    ...overrides,
  };
}

export function makeAuditLogEntry(overrides?: Partial<AuditLogEntry>): AuditLogEntry {
  const id = nextId();
  return {
    eventId: id,
    recordedAt: new Date('2026-04-02T00:00:00Z'),
    eventType: 'entity.created',
    actorId: 'user-actor-1',
    actorKind: 'user',
    payloadHash: 'abc123',
    chainHash: 'def456',
    metadata: {},
    entityId: nextId(),
    entityKind: 'policy',
    refCode: `POL-${id}`,
    entityTitle: 'Test Policy',
    entityStatus: 'active',
    entityVersion: 1,
    ...overrides,
  };
}
