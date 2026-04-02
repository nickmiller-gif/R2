/**
 * EigenX Memory Entry — segmented memory with retention and confidence.
 */
export type MemoryScope = 'session' | 'user' | 'workspace';
export type RetentionClass = 'ephemeral' | 'short_term' | 'long_term' | 'permanent';

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  key: string;
  value: Record<string, unknown>;
  retentionClass: RetentionClass;
  expiresAt: Date | null;
  confidenceBand: string;
  conflictGroup: string | null;
  supersededBy: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMemoryEntryInput {
  scope: MemoryScope;
  key: string;
  value: Record<string, unknown>;
  retentionClass?: RetentionClass;
  expiresAt?: string | null;
  confidenceBand?: string;
  ownerId: string;
}

export interface UpdateMemoryEntryInput {
  value?: Record<string, unknown>;
  retentionClass?: RetentionClass;
  expiresAt?: string | null;
  confidenceBand?: string;
  supersededBy?: string | null;
}

export interface MemoryEntryFilter {
  scope?: MemoryScope;
  ownerId?: string;
  key?: string;
  retentionClass?: RetentionClass;
}
