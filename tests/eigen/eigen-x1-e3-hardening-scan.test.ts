import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('X1/E3 hardening static audit', () => {
  it('meg neighbor loader uses in() queries, timeout fail-open, and env bounds', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/_shared/meg-neighbor-scope.ts'),
      'utf8',
    );
    expect(src).toMatch(/withNeighborLoadTimeout/);
    expect(src).toMatch(/EIGEN_MEG_NEIGHBOR_LOAD_TIMEOUT_MS/);
    expect(src).toMatch(/EIGEN_MEG_NEIGHBOR_EDGE_LIMIT/);
    expect(src).toMatch(/\.in\('source_entity_id', seeds\)/);
    expect(src).not.toMatch(/\.or\(`source_entity_id\.in\.\(/);
  });

  it('retrieve core normalizes neighbor scope and ignores client-supplied graph expansion', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/_shared/eigen-retrieve-core.ts'),
      'utf8',
    );
    expect(src).toMatch(/normalizeEntityScopeIds\(payload\.meg_neighbor_scope/);
    expect(src).toMatch(/loadMegOneHopNeighborIds/);
    expect(src).toMatch(/client input ignored/);
  });

  it('memory episode consolidate caps turns, validates UUIDs, and bounds entity episodes', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/_shared/memory-episode-consolidate.ts'),
      'utf8',
    );
    expect(src).toMatch(/isValidMegEntityId\(session\.id\)/);
    expect(src).toMatch(/sessionEpisodeTopicKey/);
    expect(src).toMatch(/MAX_TURNS_PER_EPISODE/);
    expect(src).toMatch(/MAX_ENTITY_EPISODES_PER_SESSION/);
  });

  it('chat memory recall validates session/owner UUIDs and fail-opens', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/_shared/chat-memory-recall.ts'),
      'utf8',
    );
    expect(src).toMatch(/isValidMegEntityId\(sessionId/);
    expect(src).toMatch(/isValidMegEntityId\(ownerId/);
    expect(src).toMatch(/catch \{/);
    expect(src).toMatch(/memory-episode-keys/);
  });

  it('eigen-memory-episodes gates consolidate with service role and idempotency', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/eigen-memory-episodes/index.ts'),
      'utf8',
    );
    expect(src).toMatch(/requireIdempotencyKey/);
    expect(src).toMatch(/Service role JWT required for consolidate/);
    expect(src).toMatch(/isValidEpisodeTopicKey/);
    expect(src).toMatch(/parseBoundedConsolidateInt/);
  });

  it('eigen-memory-episodes-cron uses timing-safe cron token check', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/eigen-memory-episodes-cron/index.ts'),
      'utf8',
    );
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/EIGEN_MEMORY_EPISODES_CRON_TOKEN/);
  });

  it('memory episode keys reject malformed session and entity ids', () => {
    const src = readFileSync(join(ROOT, 'src/lib/eigen/memory-episode-keys.ts'), 'utf8');
    expect(src).toMatch(/isValidMegEntityId/);
    expect(src).toMatch(/MAX_EPISODE_TOPIC_KEY_CHARS/);
  });

  it('eigen-chat fail-opens memory recall errors', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/eigen-chat/index.ts'), 'utf8');
    expect(src).toMatch(/loadChatMemoryRecallForChat failed/);
  });
});
