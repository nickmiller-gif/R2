export type GovernanceEntityKind = 'charter' | 'policy' | 'rule' | 'amendment';

export type GovernanceStatus = 'draft' | 'active' | 'superseded' | 'revoked';

export interface GovernanceEntity {
  id: string;
  kind: GovernanceEntityKind;
  status: GovernanceStatus;
  refCode: string;
  title: string;
  body: string;
  version: number;
  parentId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GovernanceTransition {
  id: string;
  entityId: string;
  fromStatus: GovernanceStatus | null;
  toStatus: GovernanceStatus;
  reason: string | null;
  actorId: string;
  transitionedAt: Date;
}

export interface CreateGovernanceEntityInput {
  kind: GovernanceEntityKind;
  refCode: string;
  title: string;
  body: string;
  parentId?: string;
  createdBy: string;
  /** Optional correlation ID forwarded to event emission. */
  correlationId?: string;
}

export interface UpdateGovernanceEntityInput {
  title?: string;
  body?: string;
}

export interface TransitionGovernanceEntityInput {
  entityId: string;
  toStatus: GovernanceStatus;
  reason?: string;
  actorId: string;
  /** Optional correlation ID forwarded to event emission. */
  correlationId?: string;
}

export interface GovernanceEntityFilter {
  kind?: GovernanceEntityKind;
  status?: GovernanceStatus;
  refCode?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}
