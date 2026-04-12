/**
 * Tests for document status transition validation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDocumentsService,
  type DocumentsDb,
  type DbDocumentRow,
} from '../../src/services/documents/documents.service.js';
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

describe('DocumentsService — status transitions', () => {
  beforeEach(() => resetFixtureCounter());

  it('allows draft → active transition', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    // Documents are created with status 'active'; seed a draft row directly
    const doc = await service.create(makeCreateDocumentInput());
    // Force status to draft via internal patch for test setup
    await db.updateDocument(doc.id, { status: 'draft' });

    const updated = await service.update(doc.id, { status: 'active' });
    expect(updated.status).toBe('active');
  });

  it('allows active → archived transition', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput());
    // create() sets status 'active'
    const updated = await service.update(doc.id, { status: 'archived' });
    expect(updated.status).toBe('archived');
  });

  it('allows active → deleted transition', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput());
    const updated = await service.update(doc.id, { status: 'deleted' });
    expect(updated.status).toBe('deleted');
  });

  it('rejects archived → active (terminal direction)', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput());
    await service.update(doc.id, { status: 'archived' });

    await expect(service.update(doc.id, { status: 'active' })).rejects.toThrow(
      /Invalid status transition/,
    );
  });

  it('rejects deleted → active', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);
    const doc = await service.create(makeCreateDocumentInput());
    await service.update(doc.id, { status: 'deleted' });

    await expect(service.update(doc.id, { status: 'active' })).rejects.toThrow(
      /Invalid status transition/,
    );
  });

  it('throws when document not found on status update', async () => {
    const db = makeMockDb();
    const service = createDocumentsService(db);

    await expect(service.update('missing-id', { status: 'archived' })).rejects.toThrow(
      'missing-id',
    );
  });
});
