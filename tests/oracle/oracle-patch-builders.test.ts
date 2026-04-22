import { describe, expect, it } from 'vitest';
import {
  buildSafeEvidenceItemPatch,
  buildSafeSignalPatch,
  buildSafeThesisPatch,
  formatAllowedEvidenceItemPatchFields,
  formatAllowedSignalPatchFields,
  formatAllowedThesisPatchFields,
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
      publication_state: 'published',
      metadata: { source: 'manual' },
      profile_id: 'should-not-pass',
      id: 'should-not-pass',
    });

    expect(patch.title).toBe('Updated title');
    expect(patch.status).toBe('active');
    expect(patch.publication_state).toBeUndefined();
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

  it('formats the signal allowlisted fields from the shared source of truth', () => {
    expect(formatAllowedSignalPatchFields()).toBe(
      'score, confidence, reasons, tags, status, analysis_document_id, source_asset_id, producer_ref, publication_notes',
    );
  });

  it('formats thesis and evidence allowlists from the shared source of truth', () => {
    expect(formatAllowedThesisPatchFields()).toBe(
      'title, thesis_statement, meg_entity_id, status, novelty_status, confidence, evidence_strength, uncertainty_summary, metadata',
    );
    expect(formatAllowedEvidenceItemPatchFields()).toBe(
      'signal_id, source_lane, source_class, source_ref, content_summary, confidence, evidence_strength, source_date, publication_url, author_info, metadata',
    );
  });
});
