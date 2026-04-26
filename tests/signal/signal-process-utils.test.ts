import { describe, expect, it } from 'vitest';
import { computeNextRetryAt, inferSignalPolicyTags } from '../../supabase/functions/_shared/signal-utils.ts';

describe('signal process utils', () => {
  it('maps privacy and routing to policy tags', () => {
    const publicTags = inferSignalPolicyTags('centralr2', 'public', ['oracle']);
    const privateTags = inferSignalPolicyTags('centralr2', 'operator', []);

    expect(publicTags).toContain('eigen_public');
    expect(publicTags).toContain('oracle_candidate');
    expect(privateTags).toContain('eigenx');
    expect(privateTags).not.toContain('oracle_candidate');
  });

  it('computes retry timestamps from a fixed clock', () => {
    const now = new Date('2026-04-26T10:00:00.000Z');
    const next = computeNextRetryAt(now, 60_000);
    expect(next).toBe('2026-04-26T10:01:00.000Z');
  });
});
