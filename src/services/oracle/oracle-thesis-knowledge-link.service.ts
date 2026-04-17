/**
 * Oracle → Eigen bridge service — links theses to knowledge chunks.
 *
 * When a thesis is published or reaches sufficient confidence, this
 * service creates links to the Eigen knowledge chunks that encode the
 * thesis insights. This is the primary cross-domain wiring between
 * Oracle (intelligence) and Eigen (knowledge operating system).
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  ThesisKnowledgeLink,
  CreateThesisKnowledgeLinkInput,
  UpdateThesisKnowledgeLinkInput,
  ThesisKnowledgeLinkFilter,
} from '../../types/oracle/thesis-knowledge-link.ts';
import { nowUtc } from '../../lib/provenance/clock.ts';
import { parseJsonbField } from './oracle-db-utils.ts';

export interface OracleThesisKnowledgeLinkService {
  create(input: CreateThesisKnowledgeLinkInput): Promise<ThesisKnowledgeLink>;
  getById(id: string): Promise<ThesisKnowledgeLink | null>;
  list(filter?: ThesisKnowledgeLinkFilter): Promise<ThesisKnowledgeLink[]>;
  update(id: string, input: UpdateThesisKnowledgeLinkInput): Promise<ThesisKnowledgeLink>;
  retract(id: string): Promise<ThesisKnowledgeLink>;
  listByThesis(thesisId: string): Promise<ThesisKnowledgeLink[]>;
  listByChunk(knowledgeChunkId: string): Promise<ThesisKnowledgeLink[]>;
}

export interface DbOracleThesisKnowledgeLinkRow {
  id: string;
  thesis_id: string;
  knowledge_chunk_id: string;
  link_type: string;
  status: string;
  confidence: number;
  distillation_notes: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface OracleThesisKnowledgeLinkDb {
  insertLink(row: DbOracleThesisKnowledgeLinkRow): Promise<DbOracleThesisKnowledgeLinkRow>;
  findLinkById(id: string): Promise<DbOracleThesisKnowledgeLinkRow | null>;
  queryLinks(filter?: ThesisKnowledgeLinkFilter): Promise<DbOracleThesisKnowledgeLinkRow[]>;
  updateLink(id: string, patch: Partial<DbOracleThesisKnowledgeLinkRow>): Promise<DbOracleThesisKnowledgeLinkRow>;
}

function rowToLink(row: DbOracleThesisKnowledgeLinkRow): ThesisKnowledgeLink {
  return {
    id: row.id,
    thesisId: row.thesis_id,
    knowledgeChunkId: row.knowledge_chunk_id,
    linkType: row.link_type as ThesisKnowledgeLink['linkType'],
    status: row.status as ThesisKnowledgeLink['status'],
    confidence: row.confidence,
    distillationNotes: row.distillation_notes,
    metadata: parseJsonbField(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleThesisKnowledgeLinkService(
  db: OracleThesisKnowledgeLinkDb,
): OracleThesisKnowledgeLinkService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertLink({
        id: crypto.randomUUID(),
        thesis_id: input.thesisId,
        knowledge_chunk_id: input.knowledgeChunkId,
        link_type: input.linkType,
        status: 'active',
        confidence: input.confidence ?? 80,
        distillation_notes: input.distillationNotes ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToLink(row);
    },

    async getById(id) {
      const row = await db.findLinkById(id);
      return row ? rowToLink(row) : null;
    },

    async list(filter) {
      const rows = await db.queryLinks(filter);
      return rows.map(rowToLink);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbOracleThesisKnowledgeLinkRow> = { updated_at: now };
      if (input.status !== undefined) patch.status = input.status;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.distillationNotes !== undefined) patch.distillation_notes = input.distillationNotes;
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);

      const row = await db.updateLink(id, patch);
      return rowToLink(row);
    },

    async retract(id) {
      const now = nowUtc().toISOString();
      const row = await db.updateLink(id, {
        status: 'retracted',
        updated_at: now,
      });
      return rowToLink(row);
    },

    async listByThesis(thesisId) {
      const rows = await db.queryLinks({ thesisId });
      return rows.map(rowToLink);
    },

    async listByChunk(knowledgeChunkId) {
      const rows = await db.queryLinks({ knowledgeChunkId });
      return rows.map(rowToLink);
    },
  };
}
