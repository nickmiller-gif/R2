import { describe, expect, it, vi } from 'vitest';
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

function makeDb(
  chunks: ChunkWithEmbedding[],
  overrides: Partial<PgVectorDb> = {},
): PgVectorDb {
  return {
    async upsertChunks(rows) {
      if (overrides.upsertChunks) return overrides.upsertChunks(rows);
    },
    async listChunksWithEmbeddings(limit) {
      if (overrides.listChunksWithEmbeddings) {
        return overrides.listChunksWithEmbeddings(limit);
      }
      return chunks.slice(0, limit);
    },
    async deleteChunks(ids) {
      if (overrides.deleteChunks) return overrides.deleteChunks(ids);
    },
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

  it('skips no-op upsert and delete calls', async () => {
    const upsertSpy = vi.fn();
    const deleteSpy = vi.fn();
    const store = new PgVectorStore(
      makeDb([], { upsertChunks: upsertSpy, deleteChunks: deleteSpy }),
    );

    await store.upsert([]);
    await store.delete([]);

    expect(upsertSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('filters by validity window before scoring', async () => {
    const chunks = [
      makeChunk('expired', [1, 0], { validTo: '2026-01-01T00:00:00Z' }),
      makeChunk('upcoming', [0, 1], { validFrom: '2027-01-01T00:00:00Z' }),
      makeChunk('active', [0.6, 0.4], { validFrom: '2025-01-01T00:00:00Z' }),
    ];
    const store = new PgVectorStore(makeDb(chunks));

    const result = await store.search(
      [1, 0],
      { validAtIso: '2026-06-01T00:00:00Z' },
      5,
    );

    expect(result).toHaveLength(1);
    expect(result[0].chunk.id).toBe('active');
  });

  it('returns zero similarity when embeddings mismatch or are zero vectors', async () => {
    const chunks = [
      makeChunk('mismatched', [1, 0]),
      makeChunk('zero', [0, 0, 0]),
    ];
    const store = new PgVectorStore(makeDb(chunks));

    const [first, second] = await store.search([1, 0, 0], {}, 5);
    expect(first.similarityScore).toBe(0);
    expect(second.similarityScore).toBe(0);
  });
});
