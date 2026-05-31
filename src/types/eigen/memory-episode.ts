/**
 * Eigen memory episode — consolidated chat memory for long operator sessions.
 */
import type { MemoryScope } from './memory-entry.js';

export interface MemoryEpisode {
  id: string;
  ownerId: string;
  scope: MemoryScope;
  sessionId: string | null;
  entityIds: string[];
  topicKey: string;
  summary: string;
  turnCount: number;
  sourceTurnIds: string[];
  sourceEntryIds: string[];
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertMemoryEpisodeInput {
  ownerId: string;
  scope: MemoryScope;
  sessionId?: string | null;
  entityIds?: string[];
  topicKey: string;
  summary: string;
  turnCount: number;
  sourceTurnIds?: string[];
  sourceEntryIds?: string[];
  windowStart: string;
  windowEnd: string;
}

export interface MemoryEpisodeFilter {
  ownerId?: string;
  scope?: MemoryScope;
  topicKey?: string;
  sessionId?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}
