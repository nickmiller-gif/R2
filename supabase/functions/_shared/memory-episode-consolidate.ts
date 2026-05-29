/**
 * Consolidates recent eigen_chat_turns into memory_episodes (service-role path).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildEpisodeSummaryFromTurns,
  entityEpisodeTopicKey,
  episodeWindowFromTurns,
  sessionEpisodeTopicKey,
  shouldConsolidateSessionTurns,
  type EpisodeTurnInput,
} from '../../../src/lib/eigen/memory-episode-consolidation.ts';
import { normalizeEntityScopeIds } from '../../../src/lib/eigen/chat-entity-context.ts';

export interface ConsolidateMemoryEpisodesOptions {
  lookbackDays?: number;
  maxSessions?: number;
}

export interface ConsolidateMemoryEpisodesResult {
  sessions_scanned: number;
  episodes_upserted: number;
  skipped_sessions: number;
}

interface SessionRow {
  id: string;
  owner_id: string;
  entity_scope: unknown;
  updated_at: string;
}

interface TurnRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_SESSIONS = 200;

export async function consolidateMemoryEpisodes(
  client: SupabaseClient,
  options: ConsolidateMemoryEpisodesOptions = {},
): Promise<ConsolidateMemoryEpisodesResult> {
  const lookbackDays = Math.max(1, Math.min(options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, 90));
  const maxSessions = Math.max(1, Math.min(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 1000));
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error: sessionsError } = await client
    .from('eigen_chat_sessions')
    .select('id,owner_id,entity_scope,updated_at')
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(maxSessions);

  if (sessionsError) {
    throw new Error(`Failed to load chat sessions: ${sessionsError.message}`);
  }

  let episodesUpserted = 0;
  let skippedSessions = 0;

  for (const session of (sessions ?? []) as SessionRow[]) {
    const { data: turns, error: turnsError } = await client
      .from('eigen_chat_turns')
      .select('id,role,content,created_at')
      .eq('session_id', session.id)
      .eq('owner_id', session.owner_id)
      .order('created_at', { ascending: true })
      .order('turn_index', { ascending: true });

    if (turnsError) {
      skippedSessions += 1;
      continue;
    }

    const turnRows = (turns ?? []) as TurnRow[];
    if (!shouldConsolidateSessionTurns(turnRows.length)) {
      skippedSessions += 1;
      continue;
    }

    const episodeTurns: EpisodeTurnInput[] = turnRows
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        id: row.id,
        role: row.role as 'user' | 'assistant',
        content: row.content,
        createdAt: row.created_at,
      }));

    const summary = buildEpisodeSummaryFromTurns(episodeTurns);
    const window = episodeWindowFromTurns(episodeTurns);
    if (!summary || !window) {
      skippedSessions += 1;
      continue;
    }

    const entityScope = Array.isArray(session.entity_scope)
      ? normalizeEntityScopeIds(
          session.entity_scope.map((item) => String(item)),
          20,
        )
      : [];

    const sessionPayload = {
      owner_id: session.owner_id,
      scope: 'session',
      session_id: session.id,
      entity_ids: entityScope,
      topic_key: sessionEpisodeTopicKey(session.id),
      summary,
      turn_count: episodeTurns.length,
      source_turn_ids: episodeTurns.map((turn) => turn.id),
      source_entry_ids: [],
      window_start: window.windowStart,
      window_end: window.windowEnd,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await client
      .from('memory_episodes')
      .upsert([sessionPayload], { onConflict: 'owner_id,scope,topic_key' });

    if (upsertError) {
      skippedSessions += 1;
      continue;
    }
    episodesUpserted += 1;

    for (const entityId of entityScope) {
      const entityPayload = {
        ...sessionPayload,
        entity_ids: [entityId],
        topic_key: entityEpisodeTopicKey(entityId),
      };
      const { error: entityUpsertError } = await client
        .from('memory_episodes')
        .upsert([entityPayload], { onConflict: 'owner_id,scope,topic_key' });
      if (!entityUpsertError) episodesUpserted += 1;
    }
  }

  return {
    sessions_scanned: (sessions ?? []).length,
    episodes_upserted: episodesUpserted,
    skipped_sessions: skippedSessions,
  };
}
