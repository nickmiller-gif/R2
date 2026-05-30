import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  EIGEN_MEMORY_EPISODE_INTRO,
  EIGEN_SESSION_MEMORY_INTRO,
  formatMemoryEpisodeForLlm,
  type ChatMemoryRecallResult,
} from '../../../src/lib/eigen/chat-memory-recall.ts';
import {
  formatSessionMemoryForLlm,
  parseSessionMemoryValue,
  sessionMemoryKeyForChat,
} from '../../../src/lib/eigen/chat-session-memory.ts';
import {
  entityEpisodeTopicKey,
  sessionEpisodeTopicKey,
} from '../../../src/lib/eigen/memory-episode-keys.ts';
import {
  isValidMegEntityId,
  normalizeEntityScopeIds,
} from '../../../src/lib/eigen/chat-entity-context.ts';

const MAX_ENTITY_EPISODE_LOOKUPS = 8;

interface EpisodeRow {
  summary: string;
  turn_count: number;
  window_end: string;
  topic_key: string;
}

function emptyRecall(): ChatMemoryRecallResult {
  return { block: '', source: 'none', intro: EIGEN_SESSION_MEMORY_INTRO };
}

export async function loadChatMemoryRecallForChat(
  client: SupabaseClient,
  sessionId: string,
  ownerId: string,
  entityScope: string[] = [],
): Promise<ChatMemoryRecallResult> {
  if (!isValidMegEntityId(sessionId.trim()) || !isValidMegEntityId(ownerId.trim())) {
    return emptyRecall();
  }

  try {
    const sessionTopic = sessionEpisodeTopicKey(sessionId);
    if (sessionTopic) {
      const { data: sessionEpisode, error: sessionEpisodeError } = await client
        .from('memory_episodes')
        .select('summary,turn_count,window_end,topic_key')
        .eq('owner_id', ownerId)
        .eq('scope', 'session')
        .eq('topic_key', sessionTopic)
        .maybeSingle();

      if (!sessionEpisodeError && sessionEpisode?.summary) {
        const row = sessionEpisode as EpisodeRow;
        const block = formatMemoryEpisodeForLlm({
          summary: row.summary,
          turnCount: row.turn_count,
          windowEnd: row.window_end,
          topicKey: row.topic_key,
        });
        if (block) {
          return { block, source: 'episode', intro: EIGEN_MEMORY_EPISODE_INTRO };
        }
      }
    }

    const entityTopicKeys = normalizeEntityScopeIds(entityScope, MAX_ENTITY_EPISODE_LOOKUPS)
      .map(entityEpisodeTopicKey)
      .filter((topicKey): topicKey is string => Boolean(topicKey));

    if (entityTopicKeys.length > 0) {
      const { data: entityEpisodes, error: entityEpisodeError } = await client
        .from('memory_episodes')
        .select('summary,turn_count,window_end,topic_key')
        .eq('owner_id', ownerId)
        .eq('scope', 'session')
        .in('topic_key', entityTopicKeys);

      if (!entityEpisodeError && entityEpisodes?.length) {
        const episodesByTopicKey = new Map<string, EpisodeRow>();
        for (const row of entityEpisodes as EpisodeRow[]) {
          if (row.summary) {
            episodesByTopicKey.set(row.topic_key, row);
          }
        }

        for (const topicKey of entityTopicKeys) {
          const row = episodesByTopicKey.get(topicKey);
          if (!row) continue;
          const block = formatMemoryEpisodeForLlm({
            summary: row.summary,
            turnCount: row.turn_count,
            windowEnd: row.window_end,
            topicKey: row.topic_key,
          });
          if (block) {
            return { block, source: 'episode', intro: EIGEN_MEMORY_EPISODE_INTRO };
          }
        }
      }
    }

    const key = sessionMemoryKeyForChat(sessionId);
    const { data, error } = await client
      .from('memory_entries')
      .select('value')
      .eq('scope', 'session')
      .eq('owner_id', ownerId)
      .eq('key', key)
      .maybeSingle();
    if (error || !data?.value) return emptyRecall();

    const turn = parseSessionMemoryValue(data.value);
    const block = formatSessionMemoryForLlm(turn);
    if (!block) return emptyRecall();
    return { block, source: 'last_turn', intro: EIGEN_SESSION_MEMORY_INTRO };
  } catch {
    return emptyRecall();
  }
}
