import { describe, expect, it } from 'vitest';
import { mapThoughtPieceToEigen } from '../../src/adapters/raysretreat/eigen-raysretreat-adapter.js';

describe('Raysretreat thought piece Eigen adapter', () => {
  const baseEvent = {
    id: 'tp-001',
    retreat_year_id: '2026-default',
    title: 'Governance in the age of AI',
    content: 'Full essay body here.',
    theme_tags: ['governance', 'strategy'],
    generated_at: '2026-04-01T12:00:00Z',
    content_hash: 'abc123',
  };

  it('defaults to public corpus with raysretreat tags', () => {
    const payload = mapThoughtPieceToEigen(baseEvent);

    expect(payload.source_system).toBe('raysretreat');
    expect(payload.source_ref).toBe('agenda_thought_pieces:tp-001');
    expect(payload.document.title).toBe('Governance in the age of AI');
    expect(payload.document.body).toBe('Full essay body here.');
    expect(payload.document.content_type).toBe('retreat_thought_piece');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('raysretreat');
    expect(payload.policy_tags).toContain('retreat-thought-piece');
  });

  it('merges theme_tags into policy_tags', () => {
    const payload = mapThoughtPieceToEigen(baseEvent);

    expect(payload.policy_tags).toContain('governance');
    expect(payload.policy_tags).toContain('strategy');
  });

  it('handles empty theme_tags gracefully', () => {
    const payload = mapThoughtPieceToEigen({ ...baseEvent, theme_tags: [] });

    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('raysretreat');
    expect(payload.policy_tags).toContain('retreat-thought-piece');
    expect(payload.policy_tags).toHaveLength(3);
  });

  it('uses eigenx when visibility is internal', () => {
    const payload = mapThoughtPieceToEigen({ ...baseEvent, visibility: 'eigenx' });

    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).not.toContain('eigen_public');
  });

  it('includes retreat metadata', () => {
    const payload = mapThoughtPieceToEigen(baseEvent);
    const meta = payload.document.metadata;

    expect(meta?.retreat_year_id).toBe('2026-default');
    expect(meta?.generated_at).toBe('2026-04-01T12:00:00Z');
    expect(meta?.content_hash).toBe('abc123');
    expect(meta?.theme_tags).toEqual(['governance', 'strategy']);
  });
});
