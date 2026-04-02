/**
 * Tests for the Oracle source pack service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOracleSourcePackService,
  type OracleSourcePackDb,
  type DbOracleSourcePackRow,
} from '../../src/services/oracle/oracle-source-pack.service.js';
import type { OracleSourcePackFilter } from '../../src/types/oracle/source-pack.js';

function makeMockDb(): OracleSourcePackDb & { rows: DbOracleSourcePackRow[] } {
  const rows: DbOracleSourcePackRow[] = [];
  return {
    rows,
    async insertSourcePack(row) {
      rows.push(row);
      return row;
    },
    async findSourcePackById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async querySourcePacks(filter?: OracleSourcePackFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.sourceLane && r.source_lane !== filter.sourceLane) return false;
        if (filter.sourceClass && r.source_class !== filter.sourceClass) return false;
        if (filter.profileId && r.profile_id !== filter.profileId) return false;
        return true;
      });
    },
  };
}

describe('OracleSourcePackService', () => {
  it('creates source pack with empty sourceIds', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    const pack = await service.create({
      name: 'Internal canonical sources',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    expect(pack.name).toBe('Internal canonical sources');
    expect(pack.sourceLane).toBe('internal_canonical');
    expect(pack.sourceClass).toBe('internal_canonical');
    expect(pack.sourceIds).toEqual([]);
    expect(pack.sourceScope).toBeNull();
    expect(pack.notes).toBeNull();
  });

  it('returns null for nonexistent source pack', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('lists filtered by sourceLane', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    await service.create({
      name: 'Internal pack 1',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    await service.create({
      name: 'External pack',
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
    });

    await service.create({
      name: 'Internal pack 2',
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
    });

    const internal = await service.list({ sourceLane: 'internal_canonical' });
    expect(internal).toHaveLength(2);
    expect(internal.every((p) => p.sourceLane === 'internal_canonical')).toBe(true);

    const external = await service.list({ sourceLane: 'external_authoritative' });
    expect(external).toHaveLength(1);
    expect(external[0].name).toBe('External pack');
  });

  it('retrieves source pack by id with all fields', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    const pack = await service.create({
      name: 'Reuters sources',
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
      profileId: 'profile-123',
      sourceScope: 'financial_markets',
      sourceIds: ['source-1', 'source-2', 'source-3'],
      notes: 'Primary news sources for market intelligence',
      governance: { platformId: 'platform-oracle' },
    });

    const retrieved = await service.getById(pack.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(pack.id);
    expect(retrieved!.name).toBe('Reuters sources');
    expect(retrieved!.sourceLane).toBe('external_authoritative');
    expect(retrieved!.sourceClass).toBe('external_authoritative');
    expect(retrieved!.profileId).toBe('profile-123');
    expect(retrieved!.sourceScope).toBe('financial_markets');
    expect(retrieved!.sourceIds).toEqual(['source-1', 'source-2', 'source-3']);
    expect(retrieved!.notes).toBe('Primary news sources for market intelligence');
    expect(retrieved!.governance).toEqual({ platformId: 'platform-oracle' });
  });

  it('lists all source packs when no filter provided', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    await service.create({
      name: 'Pack 1',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    await service.create({
      name: 'Pack 2',
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
    });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('filters by sourceClass', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    await service.create({
      name: 'Document pack',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    await service.create({
      name: 'Report pack',
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
    });

    const documents = await service.list({ sourceClass: 'internal_canonical' });
    expect(documents).toHaveLength(1);
    expect(documents[0].name).toBe('Document pack');
  });

  it('filters by profileId', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    await service.create({
      name: 'Profile A pack',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
      profileId: 'profile-a',
    });

    await service.create({
      name: 'Profile B pack',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
      profileId: 'profile-b',
    });

    const profileAPacks = await service.list({ profileId: 'profile-a' });
    expect(profileAPacks).toHaveLength(1);
    expect(profileAPacks[0].profileId).toBe('profile-a');
  });

  it('filters by multiple criteria', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    await service.create({
      name: 'Pack 1',
      sourceLane: 'internal_canonical',
      sourceClass: 'internal_canonical',
    });

    await service.create({
      name: 'Pack 2',
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
    });

    await service.create({
      name: 'Pack 3',
      sourceLane: 'external_authoritative',
      sourceClass: 'internal_canonical',
    });

    const filtered = await service.list({
      sourceLane: 'internal_canonical',
      sourceClass: 'external_analysis_context',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Pack 2');
  });

  it('stores source ids array', async () => {
    const db = makeMockDb();
    const service = createOracleSourcePackService(db);

    const sourceIds = ['src-123', 'src-456', 'src-789'];
    const pack = await service.create({
      name: 'Multi-source pack',
      sourceLane: 'external_authoritative',
      sourceClass: 'external_authoritative',
      sourceIds,
    });

    expect(pack.sourceIds).toEqual(sourceIds);
  });
});
