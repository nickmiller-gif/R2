/**
 * Tests for Oracle retrieval contract helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  makeRetrievalQuery,
  filterByRelevance,
} from '../../../src/lib/oracle/retrieval-contract.js';
import type { RetrievalResultItem } from '../../../src/lib/oracle/retrieval-contract.js';

describe('makeRetrievalQuery', () => {
  it('applies sensible defaults', () => {
    const q = makeRetrievalQuery({ query: 'market trends', intent: 'thesis_validation' });
    expect(q.query).toBe('market trends');
    expect(q.intent).toBe('thesis_validation');
    expect(q.mode).toBe('hybrid');
    expect(q.topK).toBe(10);
    expect(q.minRelevance).toBe(0.5);
  });

  it('allows overriding defaults', () => {
    const q = makeRetrievalQuery({
      query: 'pricing gaps',
      intent: 'gap_filling',
      mode: 'semantic',
      topK: 5,
      minRelevance: 0.7,
    });
    expect(q.mode).toBe('semantic');
    expect(q.topK).toBe(5);
    expect(q.minRelevance).toBe(0.7);
  });

  it('carries optional scope ids through', () => {
    const q = makeRetrievalQuery({
      query: 'validation evidence',
      intent: 'thesis_validation',
      thesisId: 'thesis-1',
      signalId: 'signal-2',
    });
    expect(q.thesisId).toBe('thesis-1');
    expect(q.signalId).toBe('signal-2');
  });

  it('accepts all intent types', () => {
    const intents = [
      'thesis_validation',
      'evidence_enrichment',
      'gap_filling',
      'contradiction_check',
      'opportunity_discovery',
    ] as const;

    for (const intent of intents) {
      const q = makeRetrievalQuery({ query: 'test', intent });
      expect(q.intent).toBe(intent);
    }
  });
});

describe('filterByRelevance', () => {
  const items: RetrievalResultItem[] = [
    {
      id: 'a',
      relevance: 0.9,
      sourceLane: 'internal_canonical',
      excerpt: 'High relevance',
      metadata: {},
    },
    {
      id: 'b',
      relevance: 0.5,
      sourceLane: 'external_authoritative',
      excerpt: 'Exactly at threshold',
      metadata: {},
    },
    {
      id: 'c',
      relevance: 0.3,
      sourceLane: 'external_perspective',
      excerpt: 'Below threshold',
      metadata: {},
    },
  ];

  it('includes items at or above the threshold', () => {
    const result = filterByRelevance(items, 0.5);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('excludes all items when threshold is 1', () => {
    const result = filterByRelevance(items, 1.0);
    expect(result).toHaveLength(0);
  });

  it('includes all items when threshold is 0', () => {
    const result = filterByRelevance(items, 0);
    expect(result).toHaveLength(3);
  });

  it('returns empty array for empty input', () => {
    expect(filterByRelevance([], 0.5)).toHaveLength(0);
  });
});
