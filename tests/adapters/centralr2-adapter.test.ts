/**
 * Tests for the CentralR2 Eigen adapter (adapters/centralr2-core/eigen-centralr2-adapter.ts).
 *
 * Covers the pure mapCentralR2EventToEigen mapping function, exercising defaults
 * and all optional field overrides.
 */
import { describe, it, expect } from 'vitest';
import { mapCentralR2EventToEigen } from '../../src/adapters/centralr2-core/eigen-centralr2-adapter.js';

describe('CentralR2 Eigen adapter', () => {
  const baseEvent = {
    asset_id: 'asset-001',
    title: 'Asset Narrative',
    narrative: 'Full narrative body here.',
  };

  it('sets source_system to centralr2-core', () => {
    expect(mapCentralR2EventToEigen(baseEvent).source_system).toBe('centralr2-core');
  });

  it('maps asset_id to source_ref', () => {
    expect(mapCentralR2EventToEigen(baseEvent).source_ref).toBe('asset-001');
  });

  it('maps title and narrative into the document', () => {
    const { document } = mapCentralR2EventToEigen(baseEvent);
    expect(document.title).toBe('Asset Narrative');
    expect(document.body).toBe('Full narrative body here.');
    expect(document.content_type).toBe('asset_narrative');
  });

  it('uses hierarchical chunking mode', () => {
    expect(mapCentralR2EventToEigen(baseEvent).chunking_mode).toBe('hierarchical');
  });

  it('defaults visibility to eigenx', () => {
    const { document, policy_tags } = mapCentralR2EventToEigen(baseEvent);
    expect(document.metadata?.visibility).toBe('eigenx');
    expect(policy_tags).toContain('eigenx');
    expect(policy_tags).not.toContain('eigen_public');
  });

  it('defaults site_id to centralr2-core in metadata', () => {
    expect(mapCentralR2EventToEigen(baseEvent).document.metadata?.site_id).toBe('centralr2-core');
  });

  it('uses a provided site_id', () => {
    const result = mapCentralR2EventToEigen({ ...baseEvent, site_id: 'my-site' });
    expect(result.document.metadata?.site_id).toBe('my-site');
  });

  it('defaults policy_tags to include eigenx and asset-intel', () => {
    const { policy_tags } = mapCentralR2EventToEigen(baseEvent);
    expect(policy_tags).toContain('eigenx');
    expect(policy_tags).toContain('asset-intel');
  });

  it('merges custom policy_tags alongside the base eigenx tag', () => {
    const { policy_tags } = mapCentralR2EventToEigen({
      ...baseEvent,
      policy_tags: ['custom-tag', 'another-tag'],
    });
    expect(policy_tags).toContain('eigenx');
    expect(policy_tags).toContain('custom-tag');
    expect(policy_tags).toContain('another-tag');
  });

  it('defaults entity_ids to an empty array', () => {
    expect(mapCentralR2EventToEigen(baseEvent).entity_ids).toEqual([]);
  });

  it('maps provided entity_ids', () => {
    const result = mapCentralR2EventToEigen({ ...baseEvent, entity_ids: ['e1', 'e2'] });
    expect(result.entity_ids).toEqual(['e1', 'e2']);
  });

  it('includes generated_at in document metadata when provided', () => {
    const result = mapCentralR2EventToEigen({ ...baseEvent, generated_at: '2026-01-01T00:00:00Z' });
    expect(result.document.metadata?.generated_at).toBe('2026-01-01T00:00:00Z');
  });

  it('defaults generated_at to null when omitted', () => {
    expect(mapCentralR2EventToEigen(baseEvent).document.metadata?.generated_at).toBeNull();
  });

  it('mirrors source_ref in document metadata', () => {
    const result = mapCentralR2EventToEigen(baseEvent);
    expect(result.document.metadata?.source_ref).toBe('asset-001');
    expect(result.document.metadata?.source_system).toBe('centralr2-core');
  });
});
