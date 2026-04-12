/**
 * Tests for document list/query behavior including pagination.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDocumentsService,
  type DocumentsDb,
  type DbDocumentRow,
} from '../../src/services/documents/documents.service.js';
import type { DocumentFilter } from '../../src/types/shared/documents.js';
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
      let result = [...rows];
      if (filter?.sourceSystem) result = result.filter((r) => r.source_system === filter.sourceSystem);
      if (filter?.ownerId) result = result.filter((r) => r.owner_id === filter.ownerId);
      if (filter?.status) result = result.filter((r) => r.status === filter.status);
      if (filter?.indexStatus) result = result.filter((r) => r.index_status === filter.indexStatus);
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? result.length;
      return result.slice(offset, offset + limit);
    },
    async updateDocument(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Document not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('DocumentsService — list and pagination', () => {
  beforeEach(() => resetFixtureCounter());

  it('returns all documents when no filter is supplied', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    await service.create(makeCreateDocumentInput());
    await service.create(makeCreateDocumentInput());
    await service.create(makeCreateDocumentInput());

    const results = await service.list();
    expect(results).toHaveLength(3);
  });

  it('filters by ownerId', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const ownerId = 'owner-abc';

    await service.create(makeCreateDocumentInput({ ownerId }));
    await service.create(makeCreateDocumentInput({ ownerId }));
    await service.create(makeCreateDocumentInput({ ownerId: 'other-owner' }));

    const results = await service.list({ ownerId });
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.ownerId === ownerId)).toBe(true);
  });

  it('filters by indexStatus', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    const doc = await service.create(makeCreateDocumentInput());
    await service.create(makeCreateDocumentInput());

    await service.markIndexed(doc.id);

    const pending = await service.list({ indexStatus: 'pending' });
    const indexed = await service.list({ indexStatus: 'indexed' });

    expect(pending).toHaveLength(1);
    expect(indexed).toHaveLength(1);
    expect(indexed[0].id).toBe(doc.id);
  });

  it('passes limit and offset to db (pagination)', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    for (let i = 0; i < 5; i++) {
      await service.create(makeCreateDocumentInput());
    }

    const page1 = await service.list({ limit: 2, offset: 0 });
    const page2 = await service.list({ limit: 2, offset: 2 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it('caps limit at 1000', async () => {
    const db = makeMockDb();
    // Verify service passes limit ≤ 1000 to db — spy via custom db
    let capturedLimit: number | undefined;
    const spyDb: DocumentsDb = {
      ...makeMockDb(),
      async queryDocuments(filter) {
        capturedLimit = filter?.limit;
        return [];
      },
    };
    const service = createDocumentsService(spyDb);

    await service.list({ limit: 5000 });
    expect(capturedLimit).toBe(1000);
  });

  it('defaults limit to 50 when not specified', async () => {
    const db = makeMockDb();
    let capturedLimit: number | undefined;
    const spyDb: DocumentsDb = {
      ...makeMockDb(),
      async queryDocuments(filter) {
        capturedLimit = filter?.limit;
        return [];
      },
    };
    const service = createDocumentsService(spyDb);

    await service.list();
    expect(capturedLimit).toBe(50);
  });
});
