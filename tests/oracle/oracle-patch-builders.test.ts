import { describe, expect, it } from 'vitest';
import {
  buildSafeEvidenceItemPatch,
  buildSafeThesisPatch,
} from '../../src/services/oracle/oracle-patch-builders.js';

describe('oracle patch builders', () => {
  it('keeps only allowlisted thesis fields', () => {
    const patch = buildSafeThesisPatch({
      title: 'Updated title',
      status: 'active',
      metadata: { source: 'manual' },
      profile_id: 'should-not-pass',
      id: 'should-not-pass',
    });

    expect(patch.title).toBe('Updated title');
    expect(patch.status).toBe('active');
    expect(patch.metadata).toEqual({ source: 'manual' });
    expect(patch.profile_id).toBeUndefined();
    expect(patch.id).toBeUndefined();
    expect(typeof patch.updated_at).toBe('string');
  });

  it('keeps only allowlisted evidence item fields', () => {
    const patch = buildSafeEvidenceItemPatch({
      source_lane: 'market',
      content_summary: 'Fresh evidence summary',
      confidence: 74,
      signal_id: 'signal-1',
      profile_id: 'should-not-pass',
      created_at: 'should-not-pass',
    });

    expect(patch.source_lane).toBe('market');
    expect(patch.content_summary).toBe('Fresh evidence summary');
    expect(patch.confidence).toBe(74);
    expect(patch.signal_id).toBe('signal-1');
    expect(patch.profile_id).toBeUndefined();
    expect(patch.created_at).toBeUndefined();
    expect(typeof patch.updated_at).toBe('string');
  });

  it('returns timestamp-only patch when no allowlisted keys are present', () => {
    const patch = buildSafeEvidenceItemPatch({
      id: 'nope',
      profile_id: 'nope',
    });

    expect(Object.keys(patch)).toEqual(['updated_at']);
  });
});
