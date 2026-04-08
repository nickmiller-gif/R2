/**
 * Eigen vector store abstraction.
 *
 * The service layer depends on this contract so retrieval logic can stay
 * backend-agnostic while MVP runs on pgvector.
 */

export interface ChunkWithEmbedding {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  chunkLevel: 'document' | 'section' | 'paragraph' | 'claim';
  headingPath: string[];
  entityIds: string[];
  policyTags: string[];
  authorityScore: number;
  freshnessScore: number;
  provenanceCompleteness: number;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface VectorFilter {
  entityScope?: string[];
  policyScope?: string[];
  validAtIso?: string;
}

export interface VectorResult {
  chunk: ChunkWithEmbedding;
  similarityScore: number;
}

export interface VectorStore {
  upsert(chunks: ChunkWithEmbedding[]): Promise<void>;
  search(queryEmbedding: number[], filters: VectorFilter, topK: number): Promise<VectorResult[]>;
  delete(chunkIds: string[]): Promise<void>;
}

/**
 * Minimal DB adapter used by PgVectorStore.
 * Keep SQL details in infrastructure code, not in retrieval services.
 */
export interface PgVectorDb {
  upsertChunks(rows: ChunkWithEmbedding[]): Promise<void>;
  listChunksWithEmbeddings(limit: number): Promise<ChunkWithEmbedding[]>;
  deleteChunks(chunkIds: string[]): Promise<void>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    magA += a[index]! * a[index]!;
    magB += b[index]! * b[index]!;
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return 0;
  return dot / denominator;
}

function passesFilters(chunk: ChunkWithEmbedding, filters: VectorFilter): boolean {
  const validAt = filters.validAtIso;
  if (validAt) {
    if (chunk.validFrom && chunk.validFrom > validAt) return false;
    if (chunk.validTo && chunk.validTo < validAt) return false;
  }

  if (filters.entityScope && filters.entityScope.length > 0) {
    if (!chunk.entityIds.some((entityId) => filters.entityScope!.includes(entityId))) return false;
  }

  if (filters.policyScope && filters.policyScope.length > 0) {
    if (!chunk.policyTags.some((policyTag) => filters.policyScope!.includes(policyTag))) return false;
  }

  return true;
}

export class PgVectorStore implements VectorStore {
  constructor(private readonly db: PgVectorDb) {}

  async upsert(chunks: ChunkWithEmbedding[]): Promise<void> {
    if (chunks.length === 0) return;
    await this.db.upsertChunks(chunks);
  }

  async search(queryEmbedding: number[], filters: VectorFilter, topK: number): Promise<VectorResult[]> {
    const candidateCount = Math.max(topK * 3, 30);
    const candidates = await this.db.listChunksWithEmbeddings(candidateCount);
    const scored = candidates
      .filter((chunk) => passesFilters(chunk, filters))
      .map((chunk) => ({
        chunk,
        similarityScore: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((left, right) => right.similarityScore - left.similarityScore);

    return scored.slice(0, topK);
  }

  async delete(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    await this.db.deleteChunks(chunkIds);
  }
}
