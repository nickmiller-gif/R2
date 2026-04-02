/**
 * Tests for the Oracle thesis-evidence link service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOracleThesisEvidenceLinkService,
  type OracleThesisEvidenceLinkDb,
  type DbOracleThesisEvidenceLinkRow,
} from '../../src/services/oracle/oracle-thesis-evidence-link.service.js';

function makeMockDb(): OracleThesisEvidenceLinkDb & { rows: DbOracleThesisEvidenceLinkRow[] } {
  const rows: DbOracleThesisEvidenceLinkRow[] = [];
  return {
    rows,
    async insertLink(row) {
      rows.push(row);
      return row;
    },
    async findLinksForThesis(thesisId) {
      return rows.filter((r) => r.thesis_id === thesisId);
    },
    async findLinksForEvidence(evidenceItemId) {
      return rows.filter((r) => r.evidence_item_id === evidenceItemId);
    },
    async deleteLink(thesisId, evidenceItemId, role) {
      const idx = rows.findIndex(
        (r) =>
          r.thesis_id === thesisId &&
          r.evidence_item_id === evidenceItemId &&
          r.role === role,
      );
      if (idx !== -1) {
        rows.splice(idx, 1);
      }
    },
  };
}

describe('OracleThesisEvidenceLinkService', () => {
  it('creates link with default weight', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-123',
      evidenceItemId: 'evidence-456',
      role: 'validation',
    });

    expect(link.thesisId).toBe('thesis-123');
    expect(link.evidenceItemId).toBe('evidence-456');
    expect(link.role).toBe('validation');
    expect(link.weight).toBe(1.0);
    expect(link.notes).toBeNull();
    expect(link.createdAt).toBeInstanceOf(Date);
  });

  it('creates link with custom weight', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-123',
      evidenceItemId: 'evidence-456',
      role: 'contradiction',
      weight: 2.5,
    });

    expect(link.weight).toBe(2.5);
  });

  it('lists links for thesis', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const thesisId = 'thesis-xyz';

    await service.create({
      thesisId,
      evidenceItemId: 'evidence-1',
      role: 'validation',
    });

    await service.create({
      thesisId,
      evidenceItemId: 'evidence-2',
      role: 'contradiction',
    });

    await service.create({
      thesisId: 'thesis-other',
      evidenceItemId: 'evidence-3',
      role: 'validation',
    });

    const links = await service.listForThesis(thesisId);

    expect(links).toHaveLength(2);
    expect(links.every((l) => l.thesisId === thesisId)).toBe(true);
    expect(links.map((l) => l.evidenceItemId)).toEqual(['evidence-1', 'evidence-2']);
  });

  it('lists links for evidence item', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const evidenceId = 'evidence-abc';

    await service.create({
      thesisId: 'thesis-1',
      evidenceItemId: evidenceId,
      role: 'validation',
    });

    await service.create({
      thesisId: 'thesis-2',
      evidenceItemId: evidenceId,
      role: 'inspiration',
    });

    await service.create({
      thesisId: 'thesis-3',
      evidenceItemId: 'evidence-other',
      role: 'validation',
    });

    const links = await service.listForEvidence(evidenceId);

    expect(links).toHaveLength(2);
    expect(links.every((l) => l.evidenceItemId === evidenceId)).toBe(true);
    expect(links.map((l) => l.thesisId)).toEqual(['thesis-1', 'thesis-2']);
  });

  it('removes link', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const thesisId = 'thesis-remove-test';
    const evidenceId = 'evidence-remove-test';

    await service.create({
      thesisId,
      evidenceItemId: evidenceId,
      role: 'validation',
    });

    const linksBefore = await service.listForThesis(thesisId);
    expect(linksBefore).toHaveLength(1);

    await service.remove(thesisId, evidenceId, 'validation');

    const linksAfter = await service.listForThesis(thesisId);
    expect(linksAfter).toHaveLength(0);
  });

  it('retrieves link with all fields', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const link = await service.create({
      thesisId: 'thesis-complete',
      evidenceItemId: 'evidence-complete',
      role: 'validation',
      weight: 1.5,
      notes: 'Strong supporting evidence from primary source',
    });

    const links = await service.listForThesis('thesis-complete');
    expect(links).toHaveLength(1);

    const retrieved = links[0];
    expect(retrieved.id).toBe(link.id);
    expect(retrieved.thesisId).toBe('thesis-complete');
    expect(retrieved.evidenceItemId).toBe('evidence-complete');
    expect(retrieved.role).toBe('validation');
    expect(retrieved.weight).toBe(1.5);
    expect(retrieved.notes).toBe('Strong supporting evidence from primary source');
  });

  it('handles multiple roles for same thesis-evidence pair', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const thesisId = 'thesis-multi';
    const evidenceId = 'evidence-multi';

    const link1 = await service.create({
      thesisId,
      evidenceItemId: evidenceId,
      role: 'validation',
      weight: 1.0,
    });

    const link2 = await service.create({
      thesisId,
      evidenceItemId: evidenceId,
      role: 'inspiration',
      weight: 2.0,
    });

    const links = await service.listForThesis(thesisId);
    expect(links).toHaveLength(2);

    await service.remove(thesisId, evidenceId, 'validation');

    const linksAfter = await service.listForThesis(thesisId);
    expect(linksAfter).toHaveLength(1);
    expect(linksAfter[0].role).toBe('inspiration');
  });

  it('removes only the exact link specified', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const thesisId = 'thesis-exact';
    const evidenceId = 'evidence-exact';

    await service.create({
      thesisId,
      evidenceItemId: evidenceId,
      role: 'validation',
    });

    await service.create({
      thesisId,
      evidenceItemId: 'evidence-other',
      role: 'validation',
    });

    await service.remove(thesisId, evidenceId, 'validation');

    const links = await service.listForThesis(thesisId);
    expect(links).toHaveLength(1);
    expect(links[0].evidenceItemId).toBe('evidence-other');
  });

  it('different evidence items for same thesis are independent', async () => {
    const db = makeMockDb();
    const service = createOracleThesisEvidenceLinkService(db);

    const thesisId = 'thesis-independent';

    await service.create({
      thesisId,
      evidenceItemId: 'evidence-a',
      role: 'validation',
    });

    await service.create({
      thesisId,
      evidenceItemId: 'evidence-b',
      role: 'validation',
    });

    const evidenceALinks = await service.listForEvidence('evidence-a');
    const evidenceBLinks = await service.listForEvidence('evidence-b');

    expect(evidenceALinks).toHaveLength(1);
    expect(evidenceBLinks).toHaveLength(1);
    expect(evidenceALinks[0].evidenceItemId).toBe('evidence-a');
    expect(evidenceBLinks[0].evidenceItemId).toBe('evidence-b');
  });
});
