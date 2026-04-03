/**
 * Tests for the Charter evidence service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharterEvidenceService,
  type CharterEvidenceDb,
  type DbCharterEvidenceRow,
} from '../../src/services/charter/evidence.service.js';
import type { CharterEvidenceFilter } from '../../src/types/charter/types.js';
import {
  makeCreateEvidenceInput,
  resetFixtureCounter,
} from './fixtures/charter-domain-fixtures.js';

function makeMockDb(): CharterEvidenceDb & { rows: DbCharterEvidenceRow[] } {
  const rows: DbCharterEvidenceRow[] = [];
  return {
    rows,
    async insertEvidence(row) {
      rows.push(row);
      return row;
    },
    async findEvidenceById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryEvidence(filter?: CharterEvidenceFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.linkedTable && r.linked_table !== filter.linkedTable) return false;
        if (filter.linkedId && r.linked_id !== filter.linkedId) return false;
        if (filter.status && r.status !== filter.status) return false;
        return true;
      });
    },
    async updateEvidence(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Evidence not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('CharterEvidenceService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates evidence with submitted status and confidence 50', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);

    const evidence = await service.create(makeCreateEvidenceInput());

    expect(evidence.status).toBe('submitted');
    expect(evidence.confidence).toBe(50);
    expect(evidence.evidenceType).toBe('document');
    expect(evidence.linkedTable).toBe('rights');
  });

  it('returns null for nonexistent evidence', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('filters evidence by linkedTable and linkedId', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);
    const linkedId = '00000000-0000-0000-0000-000000000099';
    const otherLinkedId = '00000000-0000-0000-0000-000000000098';

    await service.create(
      makeCreateEvidenceInput({ linkedTable: 'rights', linkedId }),
    );
    await service.create(
      makeCreateEvidenceInput({ linkedTable: 'rights', linkedId }),
    );
    await service.create(
      makeCreateEvidenceInput({
        linkedTable: 'rights',
        linkedId: otherLinkedId,
      }),
    );

    const filtered = await service.list({
      linkedTable: 'rights',
      linkedId,
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.linkedId === linkedId)).toBe(true);
  });

  it('updates evidence fields', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);

    const evidence = await service.create(makeCreateEvidenceInput());
    const updated = await service.update(evidence.id, {
      status: 'verified',
      confidence: 95,
      metadata: { verified: true },
    });

    expect(updated.status).toBe('verified');
    expect(updated.confidence).toBe(95);
    expect(updated.metadata).toEqual({ verified: true });
  });

  it('rejects confidence below 0 on create', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);

    await expect(
      service.create(makeCreateEvidenceInput({ confidence: -1 }))
    ).rejects.toThrow('confidence');
  });

  it('rejects confidence above 100 on create', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);

    await expect(
      service.create(makeCreateEvidenceInput({ confidence: 101 }))
    ).rejects.toThrow('confidence');
  });

  it('rejects confidence out of range on update', async () => {
    const db = makeMockDb();
    const service = createCharterEvidenceService(db);
    const evidence = await service.create(makeCreateEvidenceInput());

    await expect(
      service.update(evidence.id, { confidence: 200 })
    ).rejects.toThrow('confidence');
  });
});
