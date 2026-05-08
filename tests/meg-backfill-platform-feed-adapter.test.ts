/**
 * Covers inference used by Edge `meg-backfill-source` for `r2:platform_feed_items`
 * (same `inferActorMegResolveArgs` as `r2-signal-process` / MEG shared module).
 * Run via `npm test` (Vitest); Edge runtime uses Deno but shares this logic.
 */
import { describe, expect, it } from 'vitest';
import { inferActorMegResolveArgs } from '../supabase/functions/_shared/meg-resolve-signal.ts';

function feedRow(overrides: {
  id?: string;
  source_system?: string;
  source_event_type?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  actor_meg_entity_id?: string | null;
}) {
  return {
    id: overrides.id ?? 'feed-row-1',
    source_system: overrides.source_system ?? 'r2',
    source_event_type: overrides.source_event_type ?? 'test_event',
    summary: overrides.summary ?? 'Signal summary',
    payload: overrides.payload ?? {},
    actor_meg_entity_id: overrides.actor_meg_entity_id ?? null,
  };
}

describe('meg-backfill-source r2:platform_feed_items (inferActorMegResolveArgs)', () => {
  it('derives RPC args from email in envelope-style raw_payload', () => {
    const r = inferActorMegResolveArgs(
      feedRow({
        payload: {
          email: 'Actor@Example.com',
          actor_name: 'Actor Name',
        },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.p_canonical_email).toBe('actor@example.com');
    expect(r!.p_canonical_name).toBe('Actor Name');
    expect(r!.p_source_table).toBe('platform_feed_items');
    expect(r!.p_source_system).toBe('r2');
  });

  it('derives RPC args from external id (user_id) when no email', () => {
    const r = inferActorMegResolveArgs(
      feedRow({
        source_system: 'centralr2',
        payload: { user_id: 'usr-42', actor_name: 'Lead' },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.p_canonical_external_id).toBe('usr-42');
    expect(r!.p_canonical_email).toBeNull();
    expect(r!.p_canonical_name).toBe('Lead');
  });

  it('returns null when neither email nor external id is derivable (adapter skips row)', () => {
    expect(
      inferActorMegResolveArgs(
        feedRow({
          payload: { confidence: 0.9, unrelated: 'x' },
        }),
      ),
    ).toBeNull();
  });
});
