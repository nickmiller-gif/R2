import { describe, it, expect, vi } from 'vitest';
import { createAuditReadService } from '../../src/services/charter/audit-read.service.js';
import type { AuditReadDb, DbAuditLogRow } from '../../src/services/charter/audit-read.service.js';
import type { AuditReadQuery } from '../../src/types/charter/audit.js';

function makeAuditRow(override?: Partial<DbAuditLogRow>): DbAuditLogRow {
  return {
    event_id: 'evt-1',
    recorded_at: new Date('2026-04-02T00:00:00Z').toISOString(),
    event_type: 'entity.created',
    actor_id: 'user-1',
    actor_kind: 'user',
    payload_hash: 'abc123',
    chain_hash: 'def456',
    metadata: {},
    entity_id: 'ent-1',
    entity_kind: 'policy',
    ref_code: 'POL-001',
    entity_title: 'Test Policy',
    entity_status: 'active',
    entity_version: 1,
    ...override,
  };
}

function makeDb(overrides?: Partial<AuditReadDb>): AuditReadDb {
  const row = makeAuditRow();
  return {
    queryAuditLog: vi.fn().mockResolvedValue({ rows: [row], total: 1 }),
    findByEventId: vi.fn().mockResolvedValue(row),
    ...overrides,
  };
}

describe('AuditReadService', () => {
  it('queries audit log with filter', async () => {
    const db = makeDb();
    const svc = createAuditReadService(db);
    const q: AuditReadQuery = {
      filter: { entityId: 'ent-1' },
      sort: { field: 'recordedAt', direction: 'desc' },
      page: { limit: 10, offset: 0 },
    };

    const result = await svc.query(q);

    expect(db.queryAuditLog).toHaveBeenCalledWith(q);
    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0].eventId).toBe('evt-1');
  });

  it('maps db row to AuditLogEntry correctly', async () => {
    const db = makeDb();
    const svc = createAuditReadService(db);

    const result = await svc.query({});
    const entry = result.entries[0];

    expect(entry.entityKind).toBe('policy');
    expect(entry.entityStatus).toBe('active');
    expect(entry.recordedAt).toBeInstanceOf(Date);
  });

  it('returns entry by event id', async () => {
    const db = makeDb();
    const svc = createAuditReadService(db);

    const entry = await svc.getByEventId('evt-1');

    expect(db.findByEventId).toHaveBeenCalledWith('evt-1');
    expect(entry).not.toBeNull();
    expect(entry!.eventId).toBe('evt-1');
  });

  it('returns null when event not found', async () => {
    const db = makeDb({ findByEventId: vi.fn().mockResolvedValue(null) });
    const svc = createAuditReadService(db);

    const entry = await svc.getByEventId('missing');
    expect(entry).toBeNull();
  });

  it('returns empty result when no entries match', async () => {
    const db = makeDb({
      queryAuditLog: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    });
    const svc = createAuditReadService(db);

    const result = await svc.query({ filter: { actorId: 'nobody' } });
    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
