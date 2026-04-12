/**
 * Shared documents service — CRUD for the canonical documents table.
 *
 * Any product domain writes documents here (transcripts, summaries, reports).
 * Eigen indexes them. Oracle reads them for scoring. Chart renders them.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentFilter,
} from '../../types/shared/documents.js';
import { hashPayload } from '../../lib/provenance/hash.js';
import { nowUtc } from '../../lib/provenance/clock.js';

const DOCUMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived', 'deleted'],
  active: ['archived', 'deleted'],
  archived: ['deleted'],
  deleted: [],
};

export interface DocumentsService {
  create(input: CreateDocumentInput): Promise<Document>;
  getById(id: string): Promise<Document | null>;
  list(filter?: DocumentFilter): Promise<Document[]>;
  update(id: string, input: UpdateDocumentInput): Promise<Document>;
  /** Mark a document's indexing lifecycle as updated. */
  markIndexed(id: string, vectorStoreRef?: string): Promise<Document>;
  markEmbedded(id: string, vectorStoreRef: string): Promise<Document>;
}

export interface DbDocumentRow {
  id: string;
  source_system: string;
  source_ref: string | null;
  owner_id: string;
  title: string;
  body: string;
  content_type: string;
  status: string;
  source_url: string | null;
  source_title: string | null;
  captured_at: string | null;
  confidence: number | null;
  content_hash: string;
  index_status: string;
  indexed_at: string | null;
  embedding_status: string;
  vector_store_ref: string | null;
  extracted_text_status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentsDb {
  insertDocument(row: DbDocumentRow): Promise<DbDocumentRow>;
  findDocumentById(id: string): Promise<DbDocumentRow | null>;
  queryDocuments(filter?: DocumentFilter): Promise<DbDocumentRow[]>;
  updateDocument(id: string, patch: Partial<DbDocumentRow>): Promise<DbDocumentRow>;
}

function rowToDocument(row: DbDocumentRow): Document {
  return {
    id: row.id,
    sourceSystem: row.source_system,
    sourceRef: row.source_ref ?? null,
    ownerId: row.owner_id,
    title: row.title,
    body: row.body,
    contentType: row.content_type,
    status: row.status as Document['status'],
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    capturedAt: row.captured_at ? new Date(row.captured_at) : null,
    confidence: row.confidence,
    contentHash: row.content_hash,
    indexStatus: row.index_status as Document['indexStatus'],
    indexedAt: row.indexed_at ? new Date(row.indexed_at) : null,
    embeddingStatus: row.embedding_status as Document['embeddingStatus'],
    vectorStoreRef: row.vector_store_ref,
    extractedTextStatus: row.extracted_text_status as Document['extractedTextStatus'],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createDocumentsService(db: DocumentsDb): DocumentsService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const contentHash = hashPayload(input.body);

      const row = await db.insertDocument({
        id: crypto.randomUUID(),
        source_system: input.sourceSystem,
        source_ref: input.sourceRef ?? null,
        owner_id: input.ownerId,
        title: input.title,
        body: input.body,
        content_type: input.contentType ?? 'text/plain',
        status: 'active',
        source_url: input.sourceUrl ?? null,
        source_title: input.sourceTitle ?? null,
        captured_at: input.capturedAt?.toISOString() ?? null,
        confidence: input.confidence ?? null,
        content_hash: contentHash,
        index_status: 'pending',
        indexed_at: null,
        embedding_status: 'pending',
        vector_store_ref: null,
        extracted_text_status: 'pending',
        created_at: now,
        updated_at: now,
      });

      return rowToDocument(row);
    },

    async getById(id) {
      const row = await db.findDocumentById(id);
      return row ? rowToDocument(row) : null;
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryDocuments({ ...filter, limit, offset });
      return rows.map(rowToDocument);
    },

    async update(id, input) {
      if (input.status !== undefined) {
        const current = await db.findDocumentById(id);
        if (!current) throw new Error(`Document not found: ${id}`);
        const allowed = DOCUMENT_STATUS_TRANSITIONS[current.status] ?? [];
        if (!allowed.includes(input.status)) {
          throw new Error(
            `Invalid status transition: '${current.status}' → '${input.status}'`,
          );
        }
      }
      const patch: Partial<DbDocumentRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.title !== undefined) patch.title = input.title;
      if (input.body !== undefined) {
        patch.body = input.body;
        patch.content_hash = hashPayload(input.body);
        // Body changed — invalidate index lifecycle
        patch.index_status = 'stale';
        patch.embedding_status = 'stale';
      }
      if (input.status !== undefined) patch.status = input.status;
      if (input.sourceUrl !== undefined) patch.source_url = input.sourceUrl;
      if (input.sourceTitle !== undefined) patch.source_title = input.sourceTitle;
      if (input.confidence !== undefined) patch.confidence = input.confidence;

      const row = await db.updateDocument(id, patch);
      return rowToDocument(row);
    },

    async markIndexed(id, vectorStoreRef) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbDocumentRow> = {
        index_status: 'indexed',
        indexed_at: now,
        updated_at: now,
      };
      if (vectorStoreRef) patch.vector_store_ref = vectorStoreRef;
      const row = await db.updateDocument(id, patch);
      return rowToDocument(row);
    },

    async markEmbedded(id, vectorStoreRef) {
      const now = nowUtc().toISOString();
      const row = await db.updateDocument(id, {
        embedding_status: 'embedded',
        vector_store_ref: vectorStoreRef,
        updated_at: now,
      });
      return rowToDocument(row);
    },
  };
}
