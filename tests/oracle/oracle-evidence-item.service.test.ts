/**
 * Tests for the Oracle evidence item service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOracleEvidenceItemService,
  type OracleEvidenceItemDb,
  type DbOracleEvidenceItemRow,
} from '../../src/services/oracle/oracle-evidence-item.service.js';
import type { OracleEvidenceItemFilter } from '../../src/types/oracle/evidence-item.js';

function makeMockDb(): OracleEvidenceItemDb & { rows: DbOracleEvidenceItemRow[] } {
  const rows: DbOracleEvidenceItemRow[] = [];
  return {
    rows,
    async insertEvidenceItem(row) {
      rows.push(row);
      return row;
    },
    async findEvidenceItemById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryEvidenceItems(filter?: OracleEvidenceItemFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.sourceLane && r.source_lane !== filter.sourceLane) return false;
        if (filter.sourceClass && r.source_class !== filter.sourceClass) return false;
        if (filter.signalId && r.signal_id !== filter.signalId) return false;
        if (filter.minStrength !== undefined && r.evidence_strength !== filter.minStrength) return false;
        return true;
      });
    },
    async updateEvidenceItem(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Evidence item not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('OracleEvidenceItemService', () => {
  it('creates evidence item with default confidence', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    const item = await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    expect(item.sourceLane).toBe('internal_canonical');
    expect(item.sourceClass).toBe('internal_canonical');
    expect(item.confidence).toBe(50);
    expect(item.evidenceStrength).toBe(0);
    expect(item.citationRef).toBeNull();
    expect(item.excerpt).toBeNull();
  });

  it('returns null for nonexistent evidence item', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('lists filtered by sourceLane', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    await service.create({
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
    });

    await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
    });

    const internal = await service.list({ sourceLane: 'internal_canonical' });
    expect(internal).toHaveLength(2);
    expect(internal.every((i) => i.sourceLane === 'internal_canonical')).toBe(true);

    const external = await service.list({ sourceLane: 'external_authoritative' });
    expect(external).toHaveLength(1);
    expect(external[0].sourceClass).toBe('external_authoritative');
  });

  it('updates evidence strength', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    const item = await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
      confidence: 40,
      evidenceStrength: 0,
    });

    const updated = await service.update(item.id, {
      confidence: 85,
      evidenceStrength: 0.8,
    });

    expect(updated.confidence).toBe(85);
    expect(updated.evidenceStrength).toBe(0.8);
  });

  it('retrieves evidence item by id with all fields', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    const item = await service.create({
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
      signalId: 'signal-123',
      citationRef: 'DOI:10.1234/example',
      excerpt: 'The market shows strong signals...',
      confidence: 70,
      metadata: { source: 'reuters' },
    });

    const retrieved = await service.getById(item.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(item.id);
    expect(retrieved!.sourceLane).toBe('external_authoritative');
    expect(retrieved!.sourceClass).toBe('external_authoritative');
    expect(retrieved!.signalId).toBe('signal-123');
    expect(retrieved!.citationRef).toBe('DOI:10.1234/example');
    expect(retrieved!.excerpt).toBe('The market shows strong signals...');
    expect(retrieved!.confidence).toBe(70);
    expect(retrieved!.metadata).toEqual({ source: 'reuters' });
  });

  it('lists all evidence items when no filter provided', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    await service.create({
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
    });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('filters by multiple criteria', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    const item1 = await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    const item2 = await service.create({
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
      signalId: 'signal-999',
    });

    const filtered = await service.list({
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(item2.id);
  });

  it('updates metadata', async () => {
    const db = makeMockDb();
    const service = createOracleEvidenceItemService(db);

    const item = await service.create({
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
      metadata: { version: 1 },
    });

    const updated = await service.update(item.id, {
      metadata: { version: 2, reviewed: true },
    });

    expect(updated.metadata).toEqual({ version: 2, reviewed: true });
  });
});
