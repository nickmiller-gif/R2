/**
 * Memory Episode Service — consolidated chat memory summaries (E3).
 */

import type {
  MemoryEpisode,
  MemoryEpisodeFilter,
  UpsertMemoryEpisodeInput,
} from '../../types/eigen/memory-episode.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { withPagination } from '../../lib/service-utils/pagination.js';

export interface DbMemoryEpisodeRow {
  id: string;
  owner_id: string;
  scope: string;
  session_id: string | null;
  entity_ids: string[];
  topic_key: string;
  summary: string;
  turn_count: number;
  source_turn_ids: string[];
  source_entry_ids: string[];
  window_start: string;
  window_end: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryEpisodeDb {
  upsertEpisode(row: DbMemoryEpisodeRow): Promise<DbMemoryEpisodeRow>;
  findByTopicKey(
    ownerId: string,
    scope: string,
    topicKey: string,
  ): Promise<DbMemoryEpisodeRow | null>;
  queryEpisodes(filter?: MemoryEpisodeFilter): Promise<DbMemoryEpisodeRow[]>;
}

export interface MemoryEpisodeService {
  upsert(input: UpsertMemoryEpisodeInput): Promise<MemoryEpisode>;
  getByTopicKey(
    ownerId: string,
    scope: MemoryEpisode['scope'],
    topicKey: string,
  ): Promise<MemoryEpisode | null>;
  list(filter?: MemoryEpisodeFilter): Promise<MemoryEpisode[]>;
}

function rowToEpisode(row: DbMemoryEpisodeRow): MemoryEpisode {
  return {
    id: row.id,
    ownerId: row.owner_id,
    scope: row.scope as MemoryEpisode['scope'],
    sessionId: row.session_id,
    entityIds: row.entity_ids ?? [],
    topicKey: row.topic_key,
    summary: row.summary,
    turnCount: row.turn_count,
    sourceTurnIds: row.source_turn_ids ?? [],
    sourceEntryIds: row.source_entry_ids ?? [],
    windowStart: new Date(row.window_start),
    windowEnd: new Date(row.window_end),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createMemoryEpisodeService(db: MemoryEpisodeDb): MemoryEpisodeService {
  return {
    async upsert(input) {
      const now = nowUtc().toISOString();
      const existing = await db.findByTopicKey(input.ownerId, input.scope, input.topicKey);
      const row = await db.upsertEpisode({
        id: existing?.id ?? crypto.randomUUID(),
        owner_id: input.ownerId,
        scope: input.scope,
        session_id: input.sessionId ?? null,
        entity_ids: input.entityIds ?? [],
        topic_key: input.topicKey,
        summary: input.summary,
        turn_count: input.turnCount,
        source_turn_ids: input.sourceTurnIds ?? [],
        source_entry_ids: input.sourceEntryIds ?? [],
        window_start: input.windowStart,
        window_end: input.windowEnd,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      return rowToEpisode(row);
    },

    async getByTopicKey(ownerId, scope, topicKey) {
      const row = await db.findByTopicKey(ownerId, scope, topicKey);
      return row ? rowToEpisode(row) : null;
    },

    async list(filter) {
      const rows = await db.queryEpisodes(withPagination(filter));
      return rows.map(rowToEpisode);
    },
  };
}
