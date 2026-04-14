/**
 * Tests for the R2App Eigen adapter (adapters/r2app/eigen-r2app-adapter.ts).
 */
import { describe, it, expect } from 'vitest';
import { mapR2AppEventToEigen } from '../../src/adapters/r2app/eigen-r2app-adapter.js';

describe('R2App Eigen adapter', () => {
  const baseEvent = {
    event_id: 'evt-001',
    title: 'Conversation Event',
    transcript: 'Full transcript here.',
  };

  it('sets source_system to r2app', () => {
    expect(mapR2AppEventToEigen(baseEvent).source_system).toBe('r2app');
  });

  it('maps event_id to source_ref', () => {
    expect(mapR2AppEventToEigen(baseEvent).source_ref).toBe('evt-001');
  });

  it('maps title and transcript into the document', () => {
    const { document } = mapR2AppEventToEigen(baseEvent);
    expect(document.title).toBe('Conversation Event');
    expect(document.body).toBe('Full transcript here.');
    expect(document.content_type).toBe('conversation_transcript');
  });

  it('uses hierarchical chunking mode', () => {
    expect(mapR2AppEventToEigen(baseEvent).chunking_mode).toBe('hierarchical');
  });

  it('defaults visibility to public', () => {
    const { document, policy_tags } = mapR2AppEventToEigen(baseEvent);
    expect(document.metadata?.visibility).toBe('public');
    expect(policy_tags).toContain('eigen_public');
    expect(policy_tags).not.toContain('eigenx');
  });

  it('uses eigenx when visibility is explicitly internal', () => {
    const { document, policy_tags } = mapR2AppEventToEigen({ ...baseEvent, visibility: 'eigenx' });
    expect(document.metadata?.visibility).toBe('eigenx');
    expect(policy_tags).toContain('eigenx');
    expect(policy_tags).not.toContain('eigen_public');
  });

  it('defaults site_id to r2app in metadata', () => {
    expect(mapR2AppEventToEigen(baseEvent).document.metadata?.site_id).toBe('r2app');
  });

  it('uses a provided site_id', () => {
    const result = mapR2AppEventToEigen({ ...baseEvent, site_id: 'custom-site' });
    expect(result.document.metadata?.site_id).toBe('custom-site');
  });

  it('includes engagement tag by default', () => {
    expect(mapR2AppEventToEigen(baseEvent).policy_tags).toContain('engagement');
  });

  it('merges custom policy_tags with base tags', () => {
    const { policy_tags } = mapR2AppEventToEigen({ ...baseEvent, policy_tags: ['custom-tag'] });
    expect(policy_tags).toContain('eigen_public');
    expect(policy_tags).toContain('custom-tag');
  });

  it('defaults entity_ids to an empty array', () => {
    expect(mapR2AppEventToEigen(baseEvent).entity_ids).toEqual([]);
  });

  it('maps provided entity_ids', () => {
    const result = mapR2AppEventToEigen({ ...baseEvent, entity_ids: ['e1', 'e2'] });
    expect(result.entity_ids).toEqual(['e1', 'e2']);
  });

  it('includes captured_at in metadata when provided', () => {
    const result = mapR2AppEventToEigen({ ...baseEvent, captured_at: '2026-01-01T00:00:00Z' });
    expect(result.document.metadata?.captured_at).toBe('2026-01-01T00:00:00Z');
  });

  it('defaults captured_at to null when omitted', () => {
    expect(mapR2AppEventToEigen(baseEvent).document.metadata?.captured_at).toBeNull();
  });

  it('mirrors source_ref and source_system in document metadata', () => {
    const result = mapR2AppEventToEigen(baseEvent);
    expect(result.document.metadata?.source_ref).toBe('evt-001');
    expect(result.document.metadata?.source_system).toBe('r2app');
  });
});
