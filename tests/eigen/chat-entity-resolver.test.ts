import { describe, expect, it } from 'vitest';
import {
  collectEntityLookupHints,
  mergeExplicitAndResolvedScope,
  rankEntityLookupHits,
  resolveEntityScopeMode,
  scoreEntityLookupHit,
} from '../../src/lib/eigen/chat-entity-resolver.ts';

const SAMPLE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('chat-entity-resolver', () => {
  it('collects label and quoted hints without duplicating', () => {
    const hints = collectEntityLookupHints('Tell me about "Acme Holdings" today', 'Acme Corp');
    expect(hints).toEqual(['Acme Corp', 'Acme Holdings']);
  });

  it('prefers explicit scope and filter mode', () => {
    const resolved = mergeExplicitAndResolvedScope(
      [SAMPLE_ID],
      [{ id: OTHER_ID, score: 0.9, source: 'message', matchedText: 'Other' }],
    );
    expect(resolved.entityIds).toEqual([SAMPLE_ID]);
    expect(resolved.scopeMode).toBe('filter');
    expect(resolved.resolutionSources).toEqual(['explicit']);
  });

  it('uses boost mode for message-resolved scope', () => {
    const resolved = mergeExplicitAndResolvedScope(
      [],
      [{ id: SAMPLE_ID, score: 0.92, source: 'label', matchedText: 'Acme Corp' }],
    );
    expect(resolved.entityIds).toEqual([SAMPLE_ID]);
    expect(resolved.scopeMode).toBe('boost');
    expect(resolved.resolutionSources).toEqual(['label']);
  });

  it('ranks duplicate entity hits by highest score', () => {
    const ranked = rankEntityLookupHits([
      { id: SAMPLE_ID, score: 0.6, source: 'message', matchedText: 'Acme' },
      { id: SAMPLE_ID, score: 0.95, source: 'label', matchedText: 'Acme Corp' },
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.score).toBe(0.95);
  });

  it('scores exact label matches higher than fuzzy message matches', () => {
    const exact = scoreEntityLookupHit({
      hint: 'Acme Corp',
      matchedText: 'Acme Corp',
      source: 'label',
      exact: true,
      confidence: 100,
    });
    const fuzzy = scoreEntityLookupHit({
      hint: 'Acme',
      matchedText: 'Acme Holdings LLC',
      source: 'message',
      exact: false,
    });
    expect(exact).toBeGreaterThan(fuzzy);
  });

  it('honors requested scope mode override', () => {
    expect(
      resolveEntityScopeMode([SAMPLE_ID], 'boost', mergeExplicitAndResolvedScope([SAMPLE_ID], [])),
    ).toBe('boost');
  });
});
