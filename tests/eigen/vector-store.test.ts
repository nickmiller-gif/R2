import { describe, expect, it } from 'vitest';
import {
  PgVectorStore,
  type ChunkWithEmbedding,
  type PgVectorDb,
} from '../../src/lib/eigen/vector-store.js';

function makeChunk(
  id: string,
  embedding: number[],
  overrides: Partial<ChunkWithEmbedding> = {},
): ChunkWithEmbedding {
  return {
    id,
    documentId: 'doc-1',
    content: `chunk-${id}`,
    embedding,
    chunkLevel: 'paragraph',
    headingPath: ['Root'],
    entityIds: ['entity-a'],
    policyTags: ['public'],
    authorityScore: 70,
    freshnessScore: 80,
    provenanceCompleteness: 90,
    ...overrides,
  };
}

function makeDb(chunks: ChunkWithEmbedding[]): PgVectorDb {
  return {
    async upsertChunks() {},
    async listChunksWithEmbeddings(limit) {
      return chunks.slice(0, limit);
    },
    async deleteChunks() {},
  };
}

describe('PgVectorStore', () => {
  it('returns top results sorted by cosine similarity', async () => {
    const chunks = [
      makeChunk('c1', [1, 0, 0]),
      makeChunk('c2', [0.7, 0.3, 0]),
      makeChunk('c3', [0, 1, 0]),
    ];
    const store = new PgVectorStore(makeDb(chunks));

    const result = await store.search([1, 0, 0], {}, 2);
    expect(result).toHaveLength(2);
    expect(result[0].chunk.id).toBe('c1');
    expect(result[1].chunk.id).toBe('c2');
    expect(result[0].similarityScore).toBeGreaterThan(result[1].similarityScore);
  });

  it('applies entity and policy filters', async () => {
    const chunks = [
      makeChunk('allowed', [1, 0, 0], {
        entityIds: ['entity-a'],
        policyTags: ['internal'],
      }),
      makeChunk('blocked-policy', [0.9, 0.1, 0], {
        entityIds: ['entity-a'],
        policyTags: ['public'],
      }),
      makeChunk('blocked-entity', [0.8, 0.2, 0], {
        entityIds: ['entity-b'],
        policyTags: ['internal'],
      }),
    ];
    const store = new PgVectorStore(makeDb(chunks));

    const result = await store.search(
      [1, 0, 0],
      { entityScope: ['entity-a'], policyScope: ['internal'] },
      5,
    );
    expect(result.map((r) => r.chunk.id)).toEqual(['allowed']);
  });
});
