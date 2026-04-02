import type { GovernanceEntityKind, GovernanceStatus } from './governance.js';

export interface AuditLogEntry {
  eventId: string;
  recordedAt: Date;
  eventType: string;
  actorId: string;
  actorKind: string;
  payloadHash: string;
  chainHash: string;
  metadata: Record<string, unknown>;
  entityId: string;
  entityKind: GovernanceEntityKind;
  refCode: string;
  entityTitle: string;
  entityStatus: GovernanceStatus;
  entityVersion: number;
}

export type AuditSortField = 'recordedAt' | 'eventType' | 'entityKind' | 'entityStatus';
export type SortDirection = 'asc' | 'desc';

export interface AuditReadFilter {
  entityId?: string;
  actorId?: string;
  eventType?: string;
  entityKind?: GovernanceEntityKind;
  entityStatus?: GovernanceStatus;
  fromDate?: Date;
  toDate?: Date;
}

export interface AuditReadSort {
  field: AuditSortField;
  direction: SortDirection;
}

export interface AuditReadPage {
  limit: number;
  offset: number;
}

export interface AuditReadQuery {
  filter?: AuditReadFilter;
  sort?: AuditReadSort;
  page?: AuditReadPage;
}

export interface AuditReadResult {
  entries: AuditLogEntry[];
  total: number;
}
