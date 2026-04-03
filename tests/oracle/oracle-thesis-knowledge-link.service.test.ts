/**
 * Tests for the Oracle thesis–knowledge-link service.
 */
import { describe, it, expect } from 'vitest';
import {
  createOracleThesisKnowledgeLinkService,
  type OracleThesisKnowledgeLinkDb,
  type DbOracleThesisKnowledgeLinkRow,
} from '../../src/services/oracle/oracle-thesis-knowledge-link.service.js';
import type { ThesisKnowledgeLinkFilter } from '../../src/types/oracle/thesis-knowledge-link.js';

function makeMockDb(): OracleThesisKnowledgeLinkDb & { rows: DbOracleThesisKnowledgeLinkRow[] } {
  const rows: DbOracleThesisKnowledgeLinkRow[] = [];
  return {
    rows,
    async insertLink(row) {
      rows.push(row);
      return row;
    },
    async findLinkById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryLinks(filter?: ThesisKnowledgeLinkFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.thesisId && r.thesis_id !== filter.thesisId) return false;
        if (filter.knowledgeChunkId && r.knowledge_chunk_id !== filter.knowledgeChunkId) return false;
        if (filter.linkType && r.link_type !== filter.linkType) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateLink(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Link not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('OracleThesisKnowledgeLinkService', () => {
  it('creates link with active status and default confidence', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-1',
      knowledgeChunkId: 'chunk-1',
      linkType: 'generated',
    });

    expect(link.thesisId).toBe('thesis-1');
    expect(link.knowledgeChunkId).toBe('chunk-1');
    expect(link.linkType).toBe('generated');
    expect(link.status).toBe('active');
    expect(link.confidence).toBe(80);
    expect(link.distillationNotes).toBeNull();
    expect(link.metadata).toEqual({});
    expect(link.createdAt).toBeInstanceOf(Date);
    expect(link.updatedAt).toBeInstanceOf(Date);
  });

  it('creates link with all optional fields set', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-2',
      knowledgeChunkId: 'chunk-2',
      linkType: 'validated',
      confidence: 95,
      distillationNotes: 'Validated through primary source review.',
      metadata: { reviewer: 'system-v2' },
    });

    expect(link.confidence).toBe(95);
    expect(link.distillationNotes).toBe('Validated through primary source review.');
    expect(link.metadata).toEqual({ reviewer: 'system-v2' });
  });

  it('returns null for nonexistent link', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves link by id with all fields', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const created = await service.create({
      thesisId: 'thesis-3',
      knowledgeChunkId: 'chunk-3',
      linkType: 'refined',
      confidence: 70,
    });

    const retrieved = await service.getById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.linkType).toBe('refined');
    expect(retrieved!.confidence).toBe(70);
  });

  it('lists all links when no filter provided', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    await service.create({ thesisId: 'thesis-1', knowledgeChunkId: 'chunk-1', linkType: 'generated' });
    await service.create({ thesisId: 'thesis-2', knowledgeChunkId: 'chunk-2', linkType: 'validated' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('lists links filtered by thesisId', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    await service.create({ thesisId: 'thesis-A', knowledgeChunkId: 'chunk-1', linkType: 'generated' });
    await service.create({ thesisId: 'thesis-A', knowledgeChunkId: 'chunk-2', linkType: 'validated' });
    await service.create({ thesisId: 'thesis-B', knowledgeChunkId: 'chunk-3', linkType: 'generated' });

    const aLinks = await service.list({ thesisId: 'thesis-A' });
    expect(aLinks).toHaveLength(2);
    expect(aLinks.every((l) => l.thesisId === 'thesis-A')).toBe(true);
  });

  it('lists links filtered by status', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const link1 = await service.create({ thesisId: 'thesis-1', knowledgeChunkId: 'chunk-1', linkType: 'generated' });
    const link2 = await service.create({ thesisId: 'thesis-2', knowledgeChunkId: 'chunk-2', linkType: 'validated' });

    await service.retract(link2.id);

    const activeLinks = await service.list({ status: 'active' });
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0].id).toBe(link1.id);

    const retractedLinks = await service.list({ status: 'retracted' });
    expect(retractedLinks).toHaveLength(1);
    expect(retractedLinks[0].id).toBe(link2.id);
  });

  it('updates link fields', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-1',
      knowledgeChunkId: 'chunk-1',
      linkType: 'generated',
    });

    const updated = await service.update(link.id, {
      confidence: 90,
      distillationNotes: 'Updated notes.',
      metadata: { version: 2 },
    });

    expect(updated.confidence).toBe(90);
    expect(updated.distillationNotes).toBe('Updated notes.');
    expect(updated.metadata).toEqual({ version: 2 });
  });

  it('retract sets status to retracted', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-1',
      knowledgeChunkId: 'chunk-1',
      linkType: 'generated',
    });

    expect(link.status).toBe('active');

    const retracted = await service.retract(link.id);
    expect(retracted.status).toBe('retracted');
  });

  it('listByThesis returns links for a specific thesis', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    await service.create({ thesisId: 'thesis-X', knowledgeChunkId: 'chunk-1', linkType: 'generated' });
    await service.create({ thesisId: 'thesis-X', knowledgeChunkId: 'chunk-2', linkType: 'validated' });
    await service.create({ thesisId: 'thesis-Y', knowledgeChunkId: 'chunk-3', linkType: 'refined' });

    const xLinks = await service.listByThesis('thesis-X');
    expect(xLinks).toHaveLength(2);
    expect(xLinks.every((l) => l.thesisId === 'thesis-X')).toBe(true);
  });

  it('listByChunk returns links for a specific knowledge chunk', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    await service.create({ thesisId: 'thesis-1', knowledgeChunkId: 'chunk-Z', linkType: 'generated' });
    await service.create({ thesisId: 'thesis-2', knowledgeChunkId: 'chunk-Z', linkType: 'contradicted' });
    await service.create({ thesisId: 'thesis-3', knowledgeChunkId: 'chunk-W', linkType: 'refined' });

    const chunkZLinks = await service.listByChunk('chunk-Z');
    expect(chunkZLinks).toHaveLength(2);
    expect(chunkZLinks.every((l) => l.knowledgeChunkId === 'chunk-Z')).toBe(true);

    const chunkWLinks = await service.listByChunk('chunk-W');
    expect(chunkWLinks).toHaveLength(1);
  });

  it('assigns a unique id to each link', async () => {
    const db = makeMockDb();
    const service = createOracleThesisKnowledgeLinkService(db);

    const l1 = await service.create({ thesisId: 'thesis-1', knowledgeChunkId: 'chunk-1', linkType: 'generated' });
    const l2 = await service.create({ thesisId: 'thesis-1', knowledgeChunkId: 'chunk-2', linkType: 'validated' });

    expect(l1.id).not.toBe(l2.id);
  });
});
