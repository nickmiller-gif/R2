/**
 * Tests for the Eigen memory entry service.
 */
import { describe, it, expect } from 'vitest';
import {
  createMemoryEntryService,
  type MemoryEntryDb,
  type DbMemoryEntryRow,
} from '../../src/services/eigen/memory-entry.service.js';
import type { MemoryEntryFilter } from '../../src/types/eigen/memory-entry.js';

function makeMockDb(): MemoryEntryDb & { rows: DbMemoryEntryRow[] } {
  const rows: DbMemoryEntryRow[] = [];
  return {
    rows,
    async insertEntry(row) {
      rows.push(row);
      return row;
    },
    async findEntryById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryEntries(filter?: MemoryEntryFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.scope && r.scope !== filter.scope) return false;
        if (filter.ownerId && r.owner_id !== filter.ownerId) return false;
        if (filter.key && r.key !== filter.key) return false;
        if (filter.retentionClass && r.retention_class !== filter.retentionClass) return false;
        return true;
      });
    },
    async updateEntry(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Entry not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('MemoryEntryService', () => {
  it('creates entry with defaults', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    const entry = await service.create({
      scope: 'session',
      key: 'last_query',
      value: { query: 'What is R2?' },
      ownerId: 'user-1',
    });

    expect(entry.scope).toBe('session');
    expect(entry.key).toBe('last_query');
    expect(entry.value).toEqual({ query: 'What is R2?' });
    expect(entry.ownerId).toBe('user-1');
    expect(entry.retentionClass).toBe('short_term');
    expect(entry.confidenceBand).toBe('medium');
    expect(entry.conflictGroup).toBeNull();
    expect(entry.supersededBy).toBeNull();
    expect(entry.expiresAt).toBeNull();
  });

  it('creates entry with all optional fields', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    const entry = await service.create({
      scope: 'workspace',
      key: 'project_context',
      value: { project: 'R2 Ecosystem' },
      ownerId: 'workspace-1',
      retentionClass: 'permanent',
      expiresAt: '2027-01-01T00:00:00Z',
      confidenceBand: 'high',
    });

    expect(entry.scope).toBe('workspace');
    expect(entry.retentionClass).toBe('permanent');
    expect(entry.confidenceBand).toBe('high');
    expect(entry.expiresAt).toBeInstanceOf(Date);
  });

  it('returns null for nonexistent entry', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('lists entries filtered by scope', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    await service.create({ scope: 'session', key: 'k1', value: {}, ownerId: 'o1' });
    await service.create({ scope: 'user', key: 'k2', value: {}, ownerId: 'o1' });
    await service.create({ scope: 'session', key: 'k3', value: {}, ownerId: 'o1' });

    const sessions = await service.list({ scope: 'session' });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((e) => e.scope === 'session')).toBe(true);
  });

  it('lists entries filtered by ownerId', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    await service.create({ scope: 'user', key: 'k1', value: {}, ownerId: 'user-a' });
    await service.create({ scope: 'user', key: 'k2', value: {}, ownerId: 'user-b' });
    await service.create({ scope: 'user', key: 'k3', value: {}, ownerId: 'user-a' });

    const userA = await service.list({ ownerId: 'user-a' });
    expect(userA).toHaveLength(2);
    expect(userA.every((e) => e.ownerId === 'user-a')).toBe(true);
  });

  it('lists all entries when no filter provided', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    await service.create({ scope: 'session', key: 'a', value: {}, ownerId: 'o1' });
    await service.create({ scope: 'user', key: 'b', value: {}, ownerId: 'o2' });

    const all = await service.list();
    expect(all).toHaveLength(2);
  });

  it('updates entry value and retention', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    const entry = await service.create({
      scope: 'user',
      key: 'preferences',
      value: { theme: 'dark' },
      ownerId: 'user-1',
    });

    const updated = await service.update(entry.id, {
      value: { theme: 'light', lang: 'en' },
      retentionClass: 'long_term',
    });

    expect(updated.value).toEqual({ theme: 'light', lang: 'en' });
    expect(updated.retentionClass).toBe('long_term');
    expect(updated.key).toBe('preferences');
  });

  it('getByKey returns matching entry', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    await service.create({
      scope: 'user',
      key: 'api_key_hint',
      value: { hint: 'sk-***abc' },
      ownerId: 'user-1',
    });

    await service.create({
      scope: 'session',
      key: 'api_key_hint',
      value: { hint: 'sk-***xyz' },
      ownerId: 'user-1',
    });

    const found = await service.getByKey('user', 'user-1', 'api_key_hint');
    expect(found).not.toBeNull();
    expect(found!.scope).toBe('user');
    expect(found!.value).toEqual({ hint: 'sk-***abc' });
  });

  it('getByKey returns null when no match', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    const found = await service.getByKey('session', 'user-1', 'nonexistent');
    expect(found).toBeNull();
  });

  it('supersede sets superseded_by', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    const old = await service.create({
      scope: 'user',
      key: 'context',
      value: { version: 1 },
      ownerId: 'user-1',
    });

    const replacement = await service.create({
      scope: 'user',
      key: 'context',
      value: { version: 2 },
      ownerId: 'user-1',
    });

    const superseded = await service.supersede(old.id, replacement.id);

    expect(superseded.supersededBy).toBe(replacement.id);
    expect(superseded.key).toBe('context');
  });

  it('filters by retentionClass', async () => {
    const db = makeMockDb();
    const service = createMemoryEntryService(db);

    await service.create({ scope: 'session', key: 'k1', value: {}, ownerId: 'o1' });
    await service.create({
      scope: 'user',
      key: 'k2',
      value: {},
      ownerId: 'o1',
      retentionClass: 'permanent',
    });

    const permanent = await service.list({ retentionClass: 'permanent' });
    expect(permanent).toHaveLength(1);
    expect(permanent[0].retentionClass).toBe('permanent');
  });
});
