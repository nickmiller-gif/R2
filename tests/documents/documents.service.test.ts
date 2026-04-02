/**
 * Tests for the shared documents service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDocumentsService,
  type DocumentsDb,
  type DbDocumentRow,
} from '../../src/services/documents/documents.service.js';
import type { DocumentFilter } from '../../src/types/shared/documents.js';
import { hashPayload } from '../../src/lib/provenance/hash.js';
import { makeCreateDocumentInput, resetFixtureCounter } from '../foundation/fixtures/foundation-fixtures.js';

function makeMockDb(): DocumentsDb & { rows: DbDocumentRow[] } {
  const rows: DbDocumentRow[] = [];
  return {
    rows,
    async insertDocument(row) {
      rows.push(row);
      return row;
    },
    async findDocumentById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryDocuments(filter?: DocumentFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.sourceSystem && r.source_system !== filter.sourceSystem) return false;
        if (filter.ownerId && r.owner_id !== filter.ownerId) return false;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.indexStatus && r.index_status !== filter.indexStatus) return false;
        return true;
      });
    },
    async updateDocument(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Document not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('DocumentsService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates a document with content hash and pending index status', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const input = makeCreateDocumentInput({ body: 'Interview transcript content' });

    const doc = await service.create(input);

    expect(doc.sourceSystem).toBe('test');
    expect(doc.body).toBe('Interview transcript content');
    expect(doc.contentHash).toBe(hashPayload('Interview transcript content'));
    expect(doc.indexStatus).toBe('pending');
    expect(doc.embeddingStatus).toBe('pending');
    expect(doc.extractedTextStatus).toBe('pending');
    expect(doc.status).toBe('active');
  });

  it('returns null for nonexistent document', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('invalidates index status when body is updated', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    const doc = await service.create(makeCreateDocumentInput());
    const updated = await service.update(doc.id, { body: 'Updated content' });

    expect(updated.contentHash).toBe(hashPayload('Updated content'));
    expect(updated.indexStatus).toBe('stale');
    expect(updated.embeddingStatus).toBe('stale');
  });

  it('marks a document as indexed', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    const doc = await service.create(makeCreateDocumentInput());
    const indexed = await service.markIndexed(doc.id, 'vec_123');

    expect(indexed.indexStatus).toBe('indexed');
    expect(indexed.indexedAt).not.toBeNull();
    expect(indexed.vectorStoreRef).toBe('vec_123');
  });

  it('marks a document as embedded', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    const doc = await service.create(makeCreateDocumentInput());
    const embedded = await service.markEmbedded(doc.id, 'collection:abc:456');

    expect(embedded.embeddingStatus).toBe('embedded');
    expect(embedded.vectorStoreRef).toBe('collection:abc:456');
  });

  it('filters documents by source system', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    await service.create(makeCreateDocumentInput({ sourceSystem: 'rays_retreat' }));
    await service.create(makeCreateDocumentInput({ sourceSystem: 'charter' }));

    const results = await service.list({ sourceSystem: 'rays_retreat' });
    expect(results).toHaveLength(1);
    expect(results[0].sourceSystem).toBe('rays_retreat');
  });
});
