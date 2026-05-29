import { describe, expect, it } from 'vitest';
import {
  buildEpisodeSummaryFromTurns,
  entityEpisodeTopicKey,
  episodeWindowFromTurns,
  MAX_PAIRS_IN_SUMMARY,
  MAX_TURNS_PER_EPISODE,
  MIN_TURNS_FOR_EPISODE,
  pairEpisodeTurns,
  sessionEpisodeTopicKey,
  shouldConsolidateSessionTurns,
} from '../../src/lib/eigen/memory-episode-consolidation.ts';
import {
  createMemoryEpisodeService,
  type MemoryEpisodeDb,
  type DbMemoryEpisodeRow,
} from '../../src/services/eigen/memory-episode.service.js';

const VALID_SESSION = '550e8400-e29b-41d4-a716-446655440000';

describe('memory-episode-consolidation', () => {
  const turns = [
    {
      id: 't1',
      role: 'user' as const,
      content: 'What is the lease status?',
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    {
      id: 't2',
      role: 'assistant' as const,
      content: 'The lease is active through December.',
      createdAt: '2026-05-01T10:00:05.000Z',
    },
    {
      id: 't3',
      role: 'user' as const,
      content: 'Any renewal risks?',
      createdAt: '2026-05-01T10:01:00.000Z',
    },
    {
      id: 't4',
      role: 'assistant' as const,
      content: 'Rent escalation clause may trigger in Q4.',
      createdAt: '2026-05-01T10:01:10.000Z',
    },
  ];

  it('builds deterministic topic keys', () => {
    expect(sessionEpisodeTopicKey(VALID_SESSION)).toBe(`session:${VALID_SESSION}`);
    expect(entityEpisodeTopicKey(VALID_SESSION)).toBe(`entity:${VALID_SESSION}`);
    expect(sessionEpisodeTopicKey('bad')).toBeNull();
  });

  it('pairs user/assistant turns in order', () => {
    const pairs = pairEpisodeTurns(turns);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.[0]?.role).toBe('user');
    expect(pairs[0]?.[1]?.role).toBe('assistant');
  });

  it('summarizes turns with bounded extractive text', () => {
    const summary = buildEpisodeSummaryFromTurns(turns);
    expect(summary).toContain('lease status');
    expect(summary).toContain('renewal risks');
  });

  it('derives episode window from turn timestamps', () => {
    const window = episodeWindowFromTurns(turns);
    expect(window).toEqual({
      windowStart: '2026-05-01T10:00:00.000Z',
      windowEnd: '2026-05-01T10:01:10.000Z',
    });
  });

  it('requires minimum turn count before consolidation', () => {
    expect(shouldConsolidateSessionTurns(MIN_TURNS_FOR_EPISODE)).toBe(true);
    expect(shouldConsolidateSessionTurns(MIN_TURNS_FOR_EPISODE - 1)).toBe(false);
  });

  it('caps summary pairs and turn input', () => {
    const manyTurns = Array.from({ length: MAX_TURNS_PER_EPISODE + 20 }, (_, index) => ({
      id: `t${index}`,
      role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${index}`,
      createdAt: new Date(Date.UTC(2026, 4, 1, 10, index)).toISOString(),
    }));
    const summary = buildEpisodeSummaryFromTurns(manyTurns);
    expect(summary.length).toBeLessThanOrEqual(2403);
    expect(pairEpisodeTurns(manyTurns).length).toBeGreaterThan(MAX_PAIRS_IN_SUMMARY);
  });
});

function makeEpisodeDb(): MemoryEpisodeDb & { rows: DbMemoryEpisodeRow[] } {
  const rows: DbMemoryEpisodeRow[] = [];
  return {
    rows,
    async upsertEpisode(row) {
      const idx = rows.findIndex(
        (existing) =>
          existing.owner_id === row.owner_id &&
          existing.scope === row.scope &&
          existing.topic_key === row.topic_key,
      );
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...row };
        return rows[idx];
      }
      rows.push(row);
      return row;
    },
    async findByTopicKey(ownerId, scope, topicKey) {
      return (
        rows.find(
          (row) => row.owner_id === ownerId && row.scope === scope && row.topic_key === topicKey,
        ) ?? null
      );
    },
    async queryEpisodes(filter) {
      return rows.filter((row) => {
        if (!filter) return true;
        if (filter.ownerId && row.owner_id !== filter.ownerId) return false;
        if (filter.scope && row.scope !== filter.scope) return false;
        if (filter.topicKey && row.topic_key !== filter.topicKey) return false;
        if (filter.sessionId && row.session_id !== filter.sessionId) return false;
        if (filter.entityId && !(row.entity_ids ?? []).includes(filter.entityId)) return false;
        return true;
      });
    },
  };
}

describe('MemoryEpisodeService', () => {
  it('upserts episode by owner+scope+topic_key', async () => {
    const db = makeEpisodeDb();
    const service = createMemoryEpisodeService(db);

    const first = await service.upsert({
      ownerId: 'owner-1',
      scope: 'session',
      sessionId: VALID_SESSION,
      topicKey: sessionEpisodeTopicKey(VALID_SESSION)!,
      summary: 'First summary',
      turnCount: 4,
      windowStart: '2026-05-01T10:00:00.000Z',
      windowEnd: '2026-05-01T10:05:00.000Z',
    });

    const second = await service.upsert({
      ownerId: 'owner-1',
      scope: 'session',
      sessionId: VALID_SESSION,
      topicKey: sessionEpisodeTopicKey(VALID_SESSION)!,
      summary: 'Updated summary',
      turnCount: 6,
      windowStart: '2026-05-01T10:00:00.000Z',
      windowEnd: '2026-05-01T10:10:00.000Z',
    });

    expect(second.id).toBe(first.id);
    expect(second.summary).toBe('Updated summary');
    expect(db.rows).toHaveLength(1);
  });
});
