/**
 * EigenX Knowledge Chunk — hierarchical document chunks with authority/freshness scoring.
 */
export type ChunkLevel = 'document' | 'section' | 'paragraph' | 'claim';

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  parentChunkId: string | null;
  chunkLevel: ChunkLevel;
  headingPath: string[];
  /** MEG entity UUIDs mentioned in this chunk. */
  entityIds: string[];
  /** Optional FK to the primary MEG entity this chunk is about. */
  megEntityId: string | null;
  policyTags: string[];
  validFrom: Date | null;
  validTo: Date | null;
  authorityScore: number;
  freshnessScore: number;
  provenanceCompleteness: number;
  content: string;
  contentHash: string;
  embeddingVersion: string | null;
  ingestionRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeChunkInput {
  documentId: string;
  parentChunkId?: string | null;
  chunkLevel: ChunkLevel;
  headingPath?: string[];
  entityIds?: string[];
  /** Optional primary MEG entity this chunk is about. */
  megEntityId?: string | null;
  policyTags?: string[];
  content: string;
  authorityScore?: number;
  freshnessScore?: number;
  embeddingVersion?: string | null;
  ingestionRunId?: string | null;
}

export interface UpdateKnowledgeChunkInput {
  authorityScore?: number;
  freshnessScore?: number;
  provenanceCompleteness?: number;
  validFrom?: string | null;
  validTo?: string | null;
  embeddingVersion?: string | null;
  megEntityId?: string | null;
}

export interface KnowledgeChunkFilter {
  documentId?: string;
  chunkLevel?: ChunkLevel;
  parentChunkId?: string;
  minAuthority?: number;
  /** Filter by a MEG entity UUID appearing in the entityIds array. */
  entityId?: string;
  /** Filter by the primary MEG entity FK. */
  megEntityId?: string;
}
