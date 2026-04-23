import { describe, expect, it } from 'vitest';
import {
  buildSafeEvidenceItemPatch,
  buildSafeSignalPatch,
  buildSafeThesisPatch,
} from '../../src/services/oracle/oracle-patch-builders.js';

describe('oracle patch builders', () => {
  it('keeps only allowlisted thesis fields', () => {
    const patch = buildSafeThesisPatch({
      title: 'Updated title',
      novelty_status: 'novel',
      metadata: { source: 'manual' },
      profile_id: 'should-not-pass',
      id: 'should-not-pass',
    });

    expect(patch.title).toBe('Updated title');
    expect(patch.novelty_status).toBe('novel');
    expect(patch.metadata).toEqual({ source: 'manual' });
    expect(patch.profile_id).toBeUndefined();
    expect(patch.id).toBeUndefined();
    expect(typeof patch.updated_at).toBe('string');
  });

  it('rejects thesis governance state fields (status, publication_state)', () => {
    // Status and publication_state must flow through the audited action paths
    // (challenge/supersede for status; publish/approve/reject/defer for publication_state).
    const patch = buildSafeThesisPatch({
      title: 'Only this should pass',
      status: 'superseded',
      publication_state: 'published',
    });

    expect(patch.title).toBe('Only this should pass');
    expect(patch.status).toBeUndefined();
    expect(patch.publication_state).toBeUndefined();
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

  it('keeps only allowlisted signal fields', () => {
    const patch = buildSafeSignalPatch({
      score: 82,
      confidence: 'high',
      reasons: ['fresh intel'],
      tags: ['priority'],
      publication_notes: 'operator note',
      id: 'should-not-pass',
      version: 99,
      publication_state: 'published',
      entity_asset_id: 'should-not-pass',
    });

    expect(patch.score).toBe(82);
    expect(patch.confidence).toBe('high');
    expect(patch.reasons).toEqual(['fresh intel']);
    expect(patch.tags).toEqual(['priority']);
    expect(patch.publication_notes).toBe('operator note');
    expect(patch.id).toBeUndefined();
    expect(patch.version).toBeUndefined();
    expect(patch.publication_state).toBeUndefined();
    expect(patch.entity_asset_id).toBeUndefined();
    expect(typeof patch.updated_at).toBe('string');
  });

  it('rejects signal status writes so supersede flows through rescore', () => {
    // status transitions (notably 'superseded') must be produced by the versioned
    // rescore path that creates a new row, never by a direct in-place PATCH.
    const patch = buildSafeSignalPatch({
      score: 60,
      status: 'superseded',
    });

    expect(patch.score).toBe(60);
    expect(patch.status).toBeUndefined();
  });

  it('returns timestamp-only patch when no allowlisted keys are present', () => {
    const patch = buildSafeEvidenceItemPatch({
      id: 'nope',
      profile_id: 'nope',
    });

    expect(Object.keys(patch)).toEqual(['updated_at']);
  });
});
