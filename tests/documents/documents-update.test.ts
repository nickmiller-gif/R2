/**
 * Tests for document field-level update behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDocumentsService,
  type DocumentsDb,
  type DbDocumentRow,
} from '../../src/services/documents/documents.service.js';
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
    async queryDocuments() {
      return rows;
    },
    async updateDocument(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Document not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('DocumentsService — update behavior', () => {
  beforeEach(() => resetFixtureCounter());

  it('updates title without touching body or hash', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput({ body: 'original body' }));
    const originalHash = doc.contentHash;

    const updated = await service.update(doc.id, { title: 'New Title' });

    expect(updated.title).toBe('New Title');
    expect(updated.body).toBe('original body');
    expect(updated.contentHash).toBe(originalHash);
    expect(updated.indexStatus).toBe('pending');
  });

  it('updating body recomputes hash and marks indexes stale', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput({ body: 'original' }));
    // Simulate indexed state
    await service.markIndexed(doc.id, 'vec_001');
    await service.markEmbedded(doc.id, 'vec_001');

    const updated = await service.update(doc.id, { body: 'revised body' });

    expect(updated.contentHash).toBe(hashPayload('revised body'));
    expect(updated.indexStatus).toBe('stale');
    expect(updated.embeddingStatus).toBe('stale');
  });

  it('updates confidence field', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput());

    const updated = await service.update(doc.id, { confidence: 85 });
    expect(updated.confidence).toBe(85);
  });

  it('updates sourceUrl and sourceTitle', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput());

    const updated = await service.update(doc.id, {
      sourceUrl: 'https://example.com/doc',
      sourceTitle: 'Example Article',
    });

    expect(updated.sourceUrl).toBe('https://example.com/doc');
    expect(updated.sourceTitle).toBe('Example Article');
  });

  it('update with no fields still returns valid document', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput({ title: 'Stable' }));

    const updated = await service.update(doc.id, {});

    expect(updated.id).toBe(doc.id);
    expect(updated.title).toBe('Stable');
  });
});
