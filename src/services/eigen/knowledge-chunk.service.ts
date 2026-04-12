/**
 * Knowledge Chunk Service — hierarchical document chunks with authority/freshness scoring.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  KnowledgeChunk,
  CreateKnowledgeChunkInput,
  UpdateKnowledgeChunkInput,
  KnowledgeChunkFilter,
} from '../../types/eigen/knowledge-chunk.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbArray } from '../oracle/oracle-db-utils.js';

export interface KnowledgeChunkService {
  create(input: CreateKnowledgeChunkInput): Promise<KnowledgeChunk>;
  getById(id: string): Promise<KnowledgeChunk | null>;
  list(filter?: KnowledgeChunkFilter): Promise<KnowledgeChunk[]>;
  update(id: string, input: UpdateKnowledgeChunkInput): Promise<KnowledgeChunk>;
  getChildren(parentChunkId: string): Promise<KnowledgeChunk[]>;
}

export interface DbKnowledgeChunkRow {
  id: string;
  document_id: string;
  parent_chunk_id: string | null;
  chunk_level: string;
  heading_path: string;
  entity_ids: string;
  meg_entity_id: string | null;
  policy_tags: string;
  valid_from: string | null;
  valid_to: string | null;
  authority_score: number;
  freshness_score: number;
  provenance_completeness: number;
  content: string;
  content_hash: string;
  embedding_version: string | null;
  ingestion_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkDb {
  insertChunk(row: DbKnowledgeChunkRow): Promise<DbKnowledgeChunkRow>;
  findChunkById(id: string): Promise<DbKnowledgeChunkRow | null>;
  queryChunks(filter?: KnowledgeChunkFilter): Promise<DbKnowledgeChunkRow[]>;
  updateChunk(id: string, patch: Partial<DbKnowledgeChunkRow>): Promise<DbKnowledgeChunkRow>;
}

function rowToChunk(row: DbKnowledgeChunkRow): KnowledgeChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    parentChunkId: row.parent_chunk_id,
    chunkLevel: row.chunk_level as KnowledgeChunk['chunkLevel'],
    headingPath: parseJsonbArray(row.heading_path) as string[],
    entityIds: parseJsonbArray(row.entity_ids) as string[],
    megEntityId: row.meg_entity_id,
    policyTags: parseJsonbArray(row.policy_tags) as string[],
    validFrom: row.valid_from ? new Date(row.valid_from) : null,
    validTo: row.valid_to ? new Date(row.valid_to) : null,
    authorityScore: row.authority_score,
    freshnessScore: row.freshness_score,
    provenanceCompleteness: row.provenance_completeness,
    content: row.content,
    contentHash: row.content_hash,
    embeddingVersion: row.embedding_version,
    ingestionRunId: row.ingestion_run_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createKnowledgeChunkService(db: KnowledgeChunkDb): KnowledgeChunkService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertChunk({
        id: crypto.randomUUID(),
        document_id: input.documentId,
        parent_chunk_id: input.parentChunkId ?? null,
        chunk_level: input.chunkLevel,
        heading_path: JSON.stringify(input.headingPath ?? []),
        entity_ids: JSON.stringify(input.entityIds ?? []),
        meg_entity_id: input.megEntityId ?? null,
        policy_tags: JSON.stringify(input.policyTags ?? []),
        valid_from: null,
        valid_to: null,
        authority_score: input.authorityScore ?? 50,
        freshness_score: input.freshnessScore ?? 100,
        provenance_completeness: 0,
        content: input.content,
        content_hash: '', // hashPayload(input.content) — caller should compute
        embedding_version: input.embeddingVersion ?? null,
        ingestion_run_id: input.ingestionRunId ?? null,
        created_at: now,
        updated_at: now,
      });
      return rowToChunk(row);
    },

    async getById(id) {
      const row = await db.findChunkById(id);
      return row ? rowToChunk(row) : null;
    },

    async list(filter) {
      const rows = await db.queryChunks(filter);
      return rows.map(rowToChunk);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbKnowledgeChunkRow> = {
        updated_at: now,
      };
      if (input.authorityScore !== undefined) patch.authority_score = input.authorityScore;
      if (input.freshnessScore !== undefined) patch.freshness_score = input.freshnessScore;
      if (input.provenanceCompleteness !== undefined)
        patch.provenance_completeness = input.provenanceCompleteness;
      if (input.validFrom !== undefined)
        patch.valid_from = input.validFrom ? new Date(input.validFrom).toISOString() : null;
      if (input.validTo !== undefined)
        patch.valid_to = input.validTo ? new Date(input.validTo).toISOString() : null;
      if (input.embeddingVersion !== undefined) patch.embedding_version = input.embeddingVersion;
      if (input.megEntityId !== undefined) patch.meg_entity_id = input.megEntityId;

      const row = await db.updateChunk(id, patch);
      return rowToChunk(row);
    },

    async getChildren(parentChunkId) {
      const rows = await db.queryChunks({ parentChunkId });
      return rows.map(rowToChunk);
    },
  };
}
