/**
 * Tests for the Eigen vector search service.
 */
import { describe, it, expect } from 'vitest';
import {
  createVectorSearchService,
  type VectorSearchDb,
} from '../../src/services/eigen/vector-search.service.js';
import type { HybridSearchParams, HybridSearchRow } from '../../src/types/eigen/vector-search.js';
import { makeRetrievalQuery } from '../../src/lib/oracle/retrieval-contract.js';

function makeRow(overrides: Partial<HybridSearchRow> = {}): HybridSearchRow {
  return {
    id: 'chunk-1',
    content: 'Default chunk content for testing.',
    chunk_level: 'paragraph',
    authority_score: 75,
    freshness_score: 90,
    document_id: 'doc-1',
    heading_path: ['Section 1'],
    entity_ids: ['entity-a'],
    score: 0.85,
    ...overrides,
  };
}

function makeMockDb(rows: HybridSearchRow[] = []): VectorSearchDb & { lastParams: HybridSearchParams | null } {
  const mock = {
    lastParams: null as HybridSearchParams | null,
    async hybridSearch(params: HybridSearchParams) {
      mock.lastParams = params;
      return rows;
    },
  };
  return mock;
}

describe('VectorSearchService', () => {
  it('maps hybrid mode to equal weights', async () => {
    const db = makeMockDb([]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'test', intent: 'evidence_enrichment', mode: 'hybrid' });

    await service.search(query, [1, 2, 3], 'owner-1');

    expect(db.lastParams).not.toBeNull();
    expect(db.lastParams!.fullTextWeight).toBe(1.0);
    expect(db.lastParams!.semanticWeight).toBe(1.0);
  });

  it('maps keyword mode to full-text only', async () => {
    const db = makeMockDb([]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'test', intent: 'gap_filling', mode: 'keyword' });

    await service.search(query, [1, 2, 3], 'owner-1');

    expect(db.lastParams!.fullTextWeight).toBe(1.0);
    expect(db.lastParams!.semanticWeight).toBe(0.0);
  });

  it('maps semantic mode to vector only', async () => {
    const db = makeMockDb([]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'test', intent: 'thesis_validation', mode: 'semantic' });

    await service.search(query, [1, 2, 3], 'owner-1');

    expect(db.lastParams!.fullTextWeight).toBe(0.0);
    expect(db.lastParams!.semanticWeight).toBe(1.0);
  });

  it('passes query parameters to db correctly', async () => {
    const db = makeMockDb([]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'market analysis', intent: 'opportunity_discovery', topK: 20 });

    await service.search(query, [0.1, 0.2, 0.3], 'owner-abc');

    expect(db.lastParams!.queryText).toBe('market analysis');
    expect(db.lastParams!.queryEmbedding).toEqual([0.1, 0.2, 0.3]);
    expect(db.lastParams!.matchCount).toBe(20);
    expect(db.lastParams!.filterOwnerId).toBe('owner-abc');
    expect(db.lastParams!.rrfK).toBe(50);
  });

  it('maps rows to RetrievalResultItems with correct fields', async () => {
    const row = makeRow({
      id: 'chunk-42',
      content: 'Important finding about market trends.',
      chunk_level: 'claim',
      authority_score: 95,
      freshness_score: 80,
      document_id: 'doc-7',
      heading_path: ['Chapter 3', 'Findings'],
      entity_ids: ['ent-x', 'ent-y'],
      score: 0.92,
    });
    const db = makeMockDb([row]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'market', intent: 'evidence_enrichment' });

    const result = await service.search(query, [1], 'owner-1');

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.id).toBe('chunk-42');
    expect(item.relevance).toBe(0.92);
    expect(item.sourceLane).toBe('internal_canonical');
    expect(item.excerpt).toBe('Important finding about market trends.');
    expect(item.metadata).toEqual({
      chunkLevel: 'claim',
      authorityScore: 95,
      freshnessScore: 80,
      documentId: 'doc-7',
      headingPath: ['Chapter 3', 'Findings'],
      entityIds: ['ent-x', 'ent-y'],
    });
  });

  it('filters results by minRelevance', async () => {
    const rows = [
      makeRow({ id: 'high', score: 0.9 }),
      makeRow({ id: 'medium', score: 0.6 }),
      makeRow({ id: 'low', score: 0.3 }),
    ];
    const db = makeMockDb(rows);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'test', intent: 'gap_filling', minRelevance: 0.5 });

    const result = await service.search(query, [1], 'owner-1');

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['high', 'medium']);
  });

  it('returns all results when minRelevance is not set', async () => {
    const rows = [
      makeRow({ id: 'a', score: 0.9 }),
      makeRow({ id: 'b', score: 0.1 }),
    ];
    const db = makeMockDb(rows);
    const service = createVectorSearchService(db);
    // makeRetrievalQuery sets minRelevance: 0.5 by default
    const query = makeRetrievalQuery({ query: 'test', intent: 'gap_filling' });
    // Override minRelevance to undefined
    query.minRelevance = undefined;

    const result = await service.search(query, [1], 'owner-1');

    expect(result.items).toHaveLength(2);
  });

  it('sets producerRef and retrievedAt in result', async () => {
    const db = makeMockDb([makeRow()]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'test', intent: 'thesis_validation' });

    const result = await service.search(query, [1], 'owner-1');

    expect(result.producerRef).toBe('eigen/hybrid-search-v1');
    expect(result.retrievedAt).toBeTruthy();
    expect(new Date(result.retrievedAt).getTime()).not.toBeNaN();
  });

  it('returns empty items when no rows match', async () => {
    const db = makeMockDb([]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({ query: 'nonexistent topic', intent: 'gap_filling' });

    const result = await service.search(query, [1], 'owner-1');

    expect(result.items).toHaveLength(0);
    expect(result.query.query).toBe('nonexistent topic');
  });

  it('preserves the original query in the result', async () => {
    const db = makeMockDb([]);
    const service = createVectorSearchService(db);
    const query = makeRetrievalQuery({
      query: 'competitive landscape',
      intent: 'opportunity_discovery',
      mode: 'semantic',
      topK: 5,
      sourceLanes: ['external_authoritative'],
    });

    const result = await service.search(query, [1], 'owner-1');

    expect(result.query).toEqual(query);
  });
});
