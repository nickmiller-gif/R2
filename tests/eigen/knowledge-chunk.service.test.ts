/**
 * Tests for the Eigen knowledge chunk service.
 */
import { describe, it, expect } from 'vitest';
import {
  createKnowledgeChunkService,
  type KnowledgeChunkDb,
  type DbKnowledgeChunkRow,
} from '../../src/services/eigen/knowledge-chunk.service.js';
import type { KnowledgeChunkFilter } from '../../src/types/eigen/knowledge-chunk.js';

function makeMockDb(): KnowledgeChunkDb & { rows: DbKnowledgeChunkRow[] } {
  const rows: DbKnowledgeChunkRow[] = [];
  return {
    rows,
    async insertChunk(row) {
      rows.push(row);
      return row;
    },
    async findChunkById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryChunks(filter?: KnowledgeChunkFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.documentId && r.document_id !== filter.documentId) return false;
        if (filter.chunkLevel && r.chunk_level !== filter.chunkLevel) return false;
        if (filter.parentChunkId && r.parent_chunk_id !== filter.parentChunkId) return false;
        return true;
      });
    },
    async updateChunk(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Chunk not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('KnowledgeChunkService', () => {
  it('creates chunk with default authority and freshness scores', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    const chunk = await service.create({
      documentId: 'doc-1',
      chunkLevel: 'section',
      content: 'This is the introduction section.',
    });

    expect(chunk.documentId).toBe('doc-1');
    expect(chunk.chunkLevel).toBe('section');
    expect(chunk.content).toBe('This is the introduction section.');
    expect(chunk.authorityScore).toBe(50);
    expect(chunk.freshnessScore).toBe(100);
    expect(chunk.provenanceCompleteness).toBe(0);
    expect(chunk.parentChunkId).toBeNull();
    expect(chunk.headingPath).toEqual([]);
    expect(chunk.entityIds).toEqual([]);
    expect(chunk.policyTags).toEqual([]);
    expect(chunk.embeddingVersion).toBeNull();
    expect(chunk.ingestionRunId).toBeNull();
  });

  it('returns null for nonexistent chunk', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('creates chunk with all optional fields', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    const chunk = await service.create({
      documentId: 'doc-2',
      parentChunkId: 'parent-1',
      chunkLevel: 'paragraph',
      headingPath: ['Chapter 1', 'Introduction'],
      entityIds: ['entity-a', 'entity-b'],
      policyTags: ['pii', 'confidential'],
      content: 'Detailed paragraph content.',
      authorityScore: 85,
      freshnessScore: 90,
      embeddingVersion: 'v2.1',
      ingestionRunId: 'run-abc',
    });

    expect(chunk.parentChunkId).toBe('parent-1');
    expect(chunk.chunkLevel).toBe('paragraph');
    expect(chunk.headingPath).toEqual(['Chapter 1', 'Introduction']);
    expect(chunk.entityIds).toEqual(['entity-a', 'entity-b']);
    expect(chunk.policyTags).toEqual(['pii', 'confidential']);
    expect(chunk.authorityScore).toBe(85);
    expect(chunk.freshnessScore).toBe(90);
    expect(chunk.embeddingVersion).toBe('v2.1');
    expect(chunk.ingestionRunId).toBe('run-abc');
  });

  it('lists chunks filtered by documentId', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    await service.create({ documentId: 'doc-1', chunkLevel: 'document', content: 'Doc 1' });
    await service.create({ documentId: 'doc-2', chunkLevel: 'document', content: 'Doc 2' });
    await service.create({ documentId: 'doc-1', chunkLevel: 'section', content: 'Section of doc 1' });

    const doc1Chunks = await service.list({ documentId: 'doc-1' });
    expect(doc1Chunks).toHaveLength(2);
    expect(doc1Chunks.every((c) => c.documentId === 'doc-1')).toBe(true);
  });

  it('lists chunks filtered by chunkLevel', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    await service.create({ documentId: 'doc-1', chunkLevel: 'document', content: 'Root' });
    await service.create({ documentId: 'doc-1', chunkLevel: 'section', content: 'Section' });
    await service.create({ documentId: 'doc-1', chunkLevel: 'paragraph', content: 'Paragraph' });

    const sections = await service.list({ chunkLevel: 'section' });
    expect(sections).toHaveLength(1);
    expect(sections[0].chunkLevel).toBe('section');
  });

  it('lists all chunks when no filter provided', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    await service.create({ documentId: 'doc-1', chunkLevel: 'document', content: 'A' });
    await service.create({ documentId: 'doc-2', chunkLevel: 'section', content: 'B' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('updates authority and freshness scores', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    const chunk = await service.create({
      documentId: 'doc-1',
      chunkLevel: 'claim',
      content: 'A specific claim.',
    });

    const updated = await service.update(chunk.id, {
      authorityScore: 95,
      freshnessScore: 40,
      provenanceCompleteness: 0.8,
    });

    expect(updated.authorityScore).toBe(95);
    expect(updated.freshnessScore).toBe(40);
    expect(updated.provenanceCompleteness).toBe(0.8);
    expect(updated.content).toBe('A specific claim.');
  });

  it('gets children by parentChunkId', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    const parent = await service.create({
      documentId: 'doc-1',
      chunkLevel: 'document',
      content: 'Parent document',
    });

    await service.create({
      documentId: 'doc-1',
      parentChunkId: parent.id,
      chunkLevel: 'section',
      content: 'Child section 1',
    });

    await service.create({
      documentId: 'doc-1',
      parentChunkId: parent.id,
      chunkLevel: 'section',
      content: 'Child section 2',
    });

    await service.create({
      documentId: 'doc-1',
      chunkLevel: 'section',
      content: 'Unrelated section',
    });

    const children = await service.getChildren(parent.id);
    expect(children).toHaveLength(2);
    expect(children.every((c) => c.parentChunkId === parent.id)).toBe(true);
  });

  it('retrieves chunk by id with all fields', async () => {
    const db = makeMockDb();
    const service = createKnowledgeChunkService(db);

    const chunk = await service.create({
      documentId: 'doc-x',
      chunkLevel: 'section',
      headingPath: ['Top', 'Sub'],
      entityIds: ['e-1'],
      policyTags: ['internal'],
      content: 'Full content here',
      authorityScore: 70,
      freshnessScore: 80,
    });

    const retrieved = await service.getById(chunk.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(chunk.id);
    expect(retrieved!.documentId).toBe('doc-x');
    expect(retrieved!.headingPath).toEqual(['Top', 'Sub']);
    expect(retrieved!.entityIds).toEqual(['e-1']);
    expect(retrieved!.policyTags).toEqual(['internal']);
    expect(retrieved!.authorityScore).toBe(70);
    expect(retrieved!.freshnessScore).toBe(80);
    expect(retrieved!.createdAt).toBeInstanceOf(Date);
    expect(retrieved!.updatedAt).toBeInstanceOf(Date);
  });
});
