/**
 * Tests for the Oracle signal service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOracleSignalService,
  type OracleSignalDb,
  type DbOracleSignalRow,
} from '../../src/services/oracle/oracle-signal.service.js';
import type { OracleSignalFilter } from '../../src/types/oracle/signal.js';
import { makeCreateOracleSignalInput, resetFixtureCounter } from '../foundation/fixtures/foundation-fixtures.js';

function makeMockDb(): OracleSignalDb & { rows: DbOracleSignalRow[] } {
  const rows: DbOracleSignalRow[] = [];
  return {
    rows,
    async insertSignal(row) {
      rows.push(row);
      return row;
    },
    async findSignalById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findLatestForEntity(entityAssetId) {
      const matching = rows
        .filter((r) => r.entity_asset_id === entityAssetId && r.status === 'scored');
      // Return last inserted (simulates ORDER BY scored_at DESC, created_at DESC)
      return matching[matching.length - 1] ?? null;
    },
    async querySignals(filter?: OracleSignalFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.entityAssetId && r.entity_asset_id !== filter.entityAssetId) return false;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.confidence && r.confidence !== filter.confidence) return false;
        if (filter.minScore !== undefined && r.score < filter.minScore) return false;
        if (filter.maxScore !== undefined && r.score > filter.maxScore) return false;
        return true;
      });
    },
    async updateSignal(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Signal not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('OracleSignalService', () => {
  beforeEach(() => resetFixtureCounter());

  it('creates a signal with scored status and version 1', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);

    const signal = await service.create(makeCreateOracleSignalInput());

    expect(signal.score).toBe(75);
    expect(signal.confidence).toBe('medium');
    expect(signal.reasons).toHaveLength(3);
    expect(signal.status).toBe('scored');
    expect(signal.version).toBe(1);
    expect(signal.producerRef).toBe('oracle-score-llm-v1');
  });

  it('returns null for nonexistent signal', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);

    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves the latest signal for an entity', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);
    const entityId = '00000000-0000-0000-0000-000000000099';

    await service.create(makeCreateOracleSignalInput({ entityAssetId: entityId, score: 50 }));
    await service.create(makeCreateOracleSignalInput({ entityAssetId: entityId, score: 85 }));

    const latest = await service.getLatestForEntity(entityId);
    expect(latest).not.toBeNull();
    // Both have 'scored' status; latest by scored_at should be the second one
    expect(latest!.score).toBe(85);
  });

  it('rescores: supersedes previous and increments version', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);
    const entityId = '00000000-0000-0000-0000-000000000088';

    const first = await service.create(
      makeCreateOracleSignalInput({ entityAssetId: entityId, score: 60 }),
    );
    expect(first.version).toBe(1);

    const second = await service.rescore(
      first.id,
      makeCreateOracleSignalInput({ entityAssetId: entityId, score: 90 }),
    );

    expect(second.version).toBe(2);
    expect(second.status).toBe('scored');
    expect(second.score).toBe(90);

    // Previous should be superseded
    const previous = await service.getById(first.id);
    expect(previous!.status).toBe('superseded');
  });

  it('throws when rescoring a nonexistent signal', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);

    await expect(
      service.rescore('nonexistent', makeCreateOracleSignalInput()),
    ).rejects.toThrow('Oracle signal not found: nonexistent');
  });

  it('filters signals by score range', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);

    await service.create(makeCreateOracleSignalInput({ score: 30 }));
    await service.create(makeCreateOracleSignalInput({ score: 70 }));
    await service.create(makeCreateOracleSignalInput({ score: 95 }));

    const highScores = await service.list({ minScore: 60 });
    expect(highScores).toHaveLength(2);
    expect(highScores.every((s) => s.score >= 60)).toBe(true);
  });

  it('updates signal fields', async () => {
    const db = makeMockDb();
    const service = createOracleSignalService(db);

    const signal = await service.create(makeCreateOracleSignalInput());
    const updated = await service.update(signal.id, {
      score: 88,
      confidence: 'high',
      tags: ['validated', 'go'],
    });

    expect(updated.score).toBe(88);
    expect(updated.confidence).toBe('high');
    expect(updated.tags).toEqual(['validated', 'go']);
  });
});
