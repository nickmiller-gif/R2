import { describe, it, expect, vi } from 'vitest';
import { createGovernanceKernelService } from '../../src/services/charter/governance-kernel.service.js';
import type { GovernanceKernelDb, DbGovernanceEntityRow, DbGovernanceTransitionRow } from '../../src/services/charter/governance-kernel.service.js';
import { makeGovernanceEntity, makeCreateEntityInput } from './fixtures/governance-fixtures.js';

function makeDbRow(entity: ReturnType<typeof makeGovernanceEntity>): DbGovernanceEntityRow {
  return {
    id: entity.id,
    kind: entity.kind,
    status: entity.status,
    ref_code: entity.refCode,
    title: entity.title,
    body: entity.body,
    version: entity.version,
    parent_id: entity.parentId,
    created_by: entity.createdBy,
    created_at: entity.createdAt.toISOString(),
    updated_at: entity.updatedAt.toISOString(),
  };
}

function makeTransitionRow(override?: Partial<DbGovernanceTransitionRow>): DbGovernanceTransitionRow {
  return {
    id: 'tr-1',
    entity_id: 'ent-1',
    from_status: 'draft',
    to_status: 'active',
    reason: null,
    actor_id: 'user-1',
    transitioned_at: new Date().toISOString(),
    ...override,
  };
}

function makeDb(overrides?: Partial<GovernanceKernelDb>): GovernanceKernelDb {
  const entity = makeGovernanceEntity({ id: 'ent-1' });
  const row = makeDbRow(entity);
  return {
    insertEntity: vi.fn().mockResolvedValue(row),
    findEntityById: vi.fn().mockResolvedValue(row),
    findEntityByRefCode: vi.fn().mockResolvedValue(row),
    queryEntities: vi.fn().mockResolvedValue([row]),
    updateEntity: vi.fn().mockResolvedValue({ ...row, title: 'Updated' }),
    insertTransition: vi.fn().mockResolvedValue(makeTransitionRow()),
    ...overrides,
  };
}

describe('GovernanceKernelService', () => {
  it('creates a governance entity', async () => {
    const db = makeDb();
    const svc = createGovernanceKernelService(db);
    const input = makeCreateEntityInput({ refCode: 'POL-001' });
    const entity = await svc.create(input);

    expect(db.insertEntity).toHaveBeenCalledOnce();
    const insertedRow = vi.mocked(db.insertEntity).mock.calls[0][0];
    expect(insertedRow.ref_code).toBe('POL-001');
    expect(entity.status).toBe('draft');
  });

  it('returns entity by id', async () => {
    const db = makeDb();
    const svc = createGovernanceKernelService(db);
    const entity = await svc.getById('ent-1');

    expect(db.findEntityById).toHaveBeenCalledWith('ent-1');
    expect(entity).not.toBeNull();
    expect(entity!.id).toBe('ent-1');
  });

  it('returns null when entity not found by id', async () => {
    const db = makeDb({ findEntityById: vi.fn().mockResolvedValue(null) });
    const svc = createGovernanceKernelService(db);
    const entity = await svc.getById('missing');
    expect(entity).toBeNull();
  });

  it('returns entity by ref code', async () => {
    const db = makeDb();
    const svc = createGovernanceKernelService(db);
    const entity = await svc.getByRefCode('POL-001');

    expect(db.findEntityByRefCode).toHaveBeenCalledWith('POL-001');
    expect(entity).not.toBeNull();
  });

  it('lists entities with optional filter', async () => {
    const db = makeDb();
    const svc = createGovernanceKernelService(db);
    const entities = await svc.list({ kind: 'policy' });

    expect(db.queryEntities).toHaveBeenCalledWith({ kind: 'policy' });
    expect(entities).toHaveLength(1);
  });

  it('updates entity fields', async () => {
    const db = makeDb();
    const svc = createGovernanceKernelService(db);
    const updated = await svc.update('ent-1', { title: 'Updated' });

    expect(db.updateEntity).toHaveBeenCalledOnce();
    expect(updated.title).toBe('Updated');
  });

  it('transitions entity status', async () => {
    const db = makeDb();
    const svc = createGovernanceKernelService(db);
    const transition = await svc.transition({
      entityId: 'ent-1',
      toStatus: 'active',
      actorId: 'user-1',
    });

    expect(db.insertTransition).toHaveBeenCalledOnce();
    expect(transition.toStatus).toBe('active');
  });

  it('throws when transitioning unknown entity', async () => {
    const db = makeDb({ findEntityById: vi.fn().mockResolvedValue(null) });
    const svc = createGovernanceKernelService(db);

    await expect(
      svc.transition({ entityId: 'missing', toStatus: 'active', actorId: 'user-1' })
    ).rejects.toThrow('missing');
  });
});
