import { describe, expect, it } from 'vitest';
import {
  buildSafeEvidenceItemPatch,
  buildSafeSignalPatch,
  buildSafeThesisPatch,
  formatAllowedSignalPatchFields,
} from '../../src/services/oracle/oracle-patch-builders.js';

describe('oracle patch builders', () => {
  it('keeps only allowlisted signal fields', () => {
    const patch = buildSafeSignalPatch({
      score: 72,
      confidence: 'high',
      reasons: ['r1'],
      tags: ['t1'],
      status: 'scored',
      analysis_document_id: 'doc-1',
      source_asset_id: 'asset-1',
      producer_ref: 'producer-1',
      publication_notes: 'notes',
      id: 'should-not-pass',
      entity_asset_id: 'should-not-pass',
      version: 99,
      publication_state: 'should-not-pass',
      created_at: 'should-not-pass',
    });

    expect(patch.score).toBe(72);
    expect(patch.confidence).toBe('high');
    expect(patch.reasons).toEqual(['r1']);
    expect(patch.tags).toEqual(['t1']);
    expect(patch.status).toBe('scored');
    expect(patch.analysis_document_id).toBe('doc-1');
    expect(patch.source_asset_id).toBe('asset-1');
    expect(patch.producer_ref).toBe('producer-1');
    expect(patch.publication_notes).toBe('notes');
    expect(patch.id).toBeUndefined();
    expect(patch.entity_asset_id).toBeUndefined();
    expect(patch.version).toBeUndefined();
    expect(patch.publication_state).toBeUndefined();
    expect(patch.created_at).toBeUndefined();
    expect(typeof patch.updated_at).toBe('string');
  });

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

  it('drops publication_state from thesis patches so the publish action is the only path', () => {
    // publication_state mutations must flow through the publish / approve /
    // reject / defer actions on the oracle-theses edge function, which write
    // a matching oracle_publication_events audit row. A bare PATCH cannot be
    // allowed to flip the state silently.
    const patch = buildSafeThesisPatch({
      title: 'Drift',
      publication_state: 'published',
      published_at: '2026-04-21T00:00:00Z',
      published_by: 'should-not-pass',
      last_decision_by: 'should-not-pass',
      last_decision_at: '2026-04-21T00:00:00Z',
      decision_metadata: { hijack: true },
      superseded_by_thesis_id: 'should-not-pass',
    });

    expect(patch.title).toBe('Drift');
    expect(patch.publication_state).toBeUndefined();
    expect(patch.published_at).toBeUndefined();
    expect(patch.published_by).toBeUndefined();
    expect(patch.last_decision_by).toBeUndefined();
    expect(patch.last_decision_at).toBeUndefined();
    expect(patch.decision_metadata).toBeUndefined();
    expect(patch.superseded_by_thesis_id).toBeUndefined();
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

  it('formats the signal allowlisted fields from the shared source of truth', () => {
    expect(formatAllowedSignalPatchFields()).toBe(
      'score, confidence, reasons, tags, status, analysis_document_id, source_asset_id, producer_ref, publication_notes',
    );
  });
});
