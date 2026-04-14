/**
 * Tests for the Autonomous Capture service.
 */
import { describe, it, expect } from 'vitest';
import {
  createAutonomousCaptureService,
  type AutonomousCaptureDb,
  type DbAutonomousCaptureRow,
} from '../../src/services/eigen/autonomous-capture.service.js';
import type { AutonomousCaptureFilter } from '../../src/types/eigen/autonomous-capture.js';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function makeMockDb(): AutonomousCaptureDb & { rows: DbAutonomousCaptureRow[] } {
  const rows: DbAutonomousCaptureRow[] = [];

  return {
    rows,

    async insertCapture(row) {
      rows.push(row);
      return row;
    },

    async upsertCapture(row, _conflictColumns) {
      const existing = rows.findIndex(
        (r) => r.owner_id === row.owner_id && r.content_fingerprint === row.content_fingerprint,
      );
      if (existing !== -1) {
        // Return the existing row (simulates ON CONFLICT DO UPDATE with merged data)
        rows[existing] = { ...rows[existing], ...row };
        return rows[existing];
      }
      rows.push(row);
      return row;
    },

    async findCaptureById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },

    async findCaptureByFingerprint(ownerId, fingerprint) {
      return (
        rows.find((r) => r.owner_id === ownerId && r.content_fingerprint === fingerprint) ?? null
      );
    },

    async queryCaptures(filter?: AutonomousCaptureFilter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.ownerId && r.owner_id !== filter.ownerId) return false;
        if (filter.ingestStatus && r.ingest_status !== filter.ingestStatus) return false;
        if (filter.sessionLabel && r.session_label !== filter.sessionLabel) return false;
        return true;
      });
    },

    async updateCapture(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Capture not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_INPUT = {
  ownerId: 'user-abc',
  sourceUrl: 'https://example.com/article',
  contentFingerprint: 'fp-001',
  rawExcerpt: 'This is the raw text from the page.',
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutonomousCaptureService', () => {
  describe('create()', () => {
    it('creates a capture with defaults', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);

      expect(capture.ownerId).toBe('user-abc');
      expect(capture.sourceUrl).toBe('https://example.com/article');
      expect(capture.contentFingerprint).toBe('fp-001');
      expect(capture.rawExcerpt).toBe('This is the raw text from the page.');
      expect(capture.ingestStatus).toBe('pending');
      expect(capture.ingestError).toBeNull();
      expect(capture.ingestedDocumentId).toBeNull();
      expect(capture.ingestedAt).toBeNull();
      expect(capture.summary).toBeNull();
      expect(capture.summaryModel).toBeNull();
      expect(capture.confidenceLabel).toBeNull();
      expect(capture.sessionLabel).toBeNull();
      expect(capture.oracleRunId).toBeNull();
      expect(capture.charterDecisionId).toBeNull();
      expect(capture.metadata).toEqual({});
      expect(typeof capture.id).toBe('string');
      expect(capture.createdAt).toBeInstanceOf(Date);
      expect(capture.updatedAt).toBeInstanceOf(Date);
    });

    it('stores optional fields when provided', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create({
        ...BASE_INPUT,
        pageTitle: 'My Article',
        summary: 'Three key bullets.',
        summaryModel: 'gpt-4o-mini',
        confidenceLabel: 'high',
        sessionLabel: 'research-session-1',
        oracleRunId: 'oracle-run-1',
        charterDecisionId: 'decision-1',
        metadata: { browser: 'chrome' },
      });

      expect(capture.pageTitle).toBe('My Article');
      expect(capture.summary).toBe('Three key bullets.');
      expect(capture.summaryModel).toBe('gpt-4o-mini');
      expect(capture.confidenceLabel).toBe('high');
      expect(capture.sessionLabel).toBe('research-session-1');
      expect(capture.oracleRunId).toBe('oracle-run-1');
      expect(capture.charterDecisionId).toBe('decision-1');
      expect(capture.metadata).toEqual({ browser: 'chrome' });
    });
  });

  describe('upsert()', () => {
    it('inserts a new capture on first call', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.upsert(BASE_INPUT);

      expect(capture.contentFingerprint).toBe('fp-001');
      expect(db.rows).toHaveLength(1);
    });

    it('returns the existing capture when fingerprint conflicts', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const first = await service.upsert(BASE_INPUT);
      const second = await service.upsert({ ...BASE_INPUT, pageTitle: 'Updated Title' });

      expect(db.rows).toHaveLength(1);
      expect(second.id).toBe(first.id);
    });
  });

  describe('getById()', () => {
    it('returns null for unknown id', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);
      expect(await service.getById('no-such-id')).toBeNull();
    });

    it('returns the capture by id', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const created = await service.create(BASE_INPUT);
      const found = await service.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });
  });

  describe('getByFingerprint()', () => {
    it('returns null when no match', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);
      expect(await service.getByFingerprint('user-abc', 'fp-missing')).toBeNull();
    });

    it('returns the matching capture', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      await service.create(BASE_INPUT);
      const found = await service.getByFingerprint('user-abc', 'fp-001');

      expect(found).not.toBeNull();
      expect(found!.contentFingerprint).toBe('fp-001');
    });
  });

  describe('list()', () => {
    it('lists all captures without filter', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      await service.create(BASE_INPUT);
      await service.create({ ...BASE_INPUT, contentFingerprint: 'fp-002', ownerId: 'user-xyz' });

      const all = await service.list();
      expect(all).toHaveLength(2);
    });

    it('filters by ownerId', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      await service.create(BASE_INPUT);
      await service.create({ ...BASE_INPUT, contentFingerprint: 'fp-002', ownerId: 'user-xyz' });

      const filtered = await service.list({ ownerId: 'user-abc' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].ownerId).toBe('user-abc');
    });

    it('filters by ingestStatus', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);
      await service.markIngested(capture.id, 'doc-123');
      await service.create({ ...BASE_INPUT, contentFingerprint: 'fp-002' });

      const ingested = await service.list({ ingestStatus: 'ingested' });
      expect(ingested).toHaveLength(1);
      expect(ingested[0].ingestStatus).toBe('ingested');
    });

    it('filters by sessionLabel', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      await service.create({ ...BASE_INPUT, sessionLabel: 'session-A' });
      await service.create({
        ...BASE_INPUT,
        contentFingerprint: 'fp-002',
        sessionLabel: 'session-B',
      });

      const results = await service.list({ sessionLabel: 'session-A' });
      expect(results).toHaveLength(1);
      expect(results[0].sessionLabel).toBe('session-A');
    });
  });

  describe('update()', () => {
    it('updates summary fields', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);
      const updated = await service.update(capture.id, {
        summary: 'Updated summary.',
        summaryModel: 'claude-3-5-sonnet',
        confidenceLabel: 'medium',
      });

      expect(updated.summary).toBe('Updated summary.');
      expect(updated.summaryModel).toBe('claude-3-5-sonnet');
      expect(updated.confidenceLabel).toBe('medium');
    });

    it('updates metadata', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);
      const updated = await service.update(capture.id, {
        metadata: { tags: ['important'] },
      });

      expect(updated.metadata).toEqual({ tags: ['important'] });
    });
  });

  describe('markIngested()', () => {
    it('marks as ingested with document id', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);
      const updated = await service.markIngested(capture.id, 'doc-abc');

      expect(updated.ingestStatus).toBe('ingested');
      expect(updated.ingestError).toBeNull();
      expect(updated.ingestedDocumentId).toBe('doc-abc');
      expect(updated.ingestedAt).toBeInstanceOf(Date);
    });

    it('accepts null document id', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);
      const updated = await service.markIngested(capture.id, null);

      expect(updated.ingestStatus).toBe('ingested');
      expect(updated.ingestedDocumentId).toBeNull();
      expect(updated.ingestedAt).toBeInstanceOf(Date);
    });
  });

  describe('markFailed()', () => {
    it('marks as failed with error message', async () => {
      const db = makeMockDb();
      const service = createAutonomousCaptureService(db);

      const capture = await service.create(BASE_INPUT);
      const updated = await service.markFailed(capture.id, 'eigen-ingest timeout');

      expect(updated.ingestStatus).toBe('failed');
      expect(updated.ingestError).toBe('eigen-ingest timeout');
      expect(updated.ingestedDocumentId).toBeNull();
    });
  });
});
