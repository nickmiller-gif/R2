import type {
  GovernanceEntity,
  GovernanceTransition,
  CreateGovernanceEntityInput,
  UpdateGovernanceEntityInput,
  TransitionGovernanceEntityInput,
  GovernanceEntityFilter,
} from '../../types/charter/governance.js';
import type { CharterEventEmitter } from './charter-event-emitter.js';
import { assertNonEmpty, assertMaxLength } from '../../lib/charter/validate.js';

export interface GovernanceKernelService {
  create(input: CreateGovernanceEntityInput): Promise<GovernanceEntity>;
  getById(id: string): Promise<GovernanceEntity | null>;
  getByRefCode(refCode: string): Promise<GovernanceEntity | null>;
  list(filter?: GovernanceEntityFilter): Promise<GovernanceEntity[]>;
  update(id: string, input: UpdateGovernanceEntityInput): Promise<GovernanceEntity>;
  transition(input: TransitionGovernanceEntityInput): Promise<GovernanceTransition>;
}

export interface GovernanceKernelDb {
  insertEntity(row: DbGovernanceEntityRow): Promise<DbGovernanceEntityRow>;
  findEntityById(id: string): Promise<DbGovernanceEntityRow | null>;
  findEntityByRefCode(refCode: string): Promise<DbGovernanceEntityRow | null>;
  queryEntities(filter?: GovernanceEntityFilter): Promise<DbGovernanceEntityRow[]>;
  updateEntity(id: string, patch: Partial<DbGovernanceEntityRow>): Promise<DbGovernanceEntityRow>;
  insertTransition(row: DbGovernanceTransitionRow): Promise<DbGovernanceTransitionRow>;
}

export interface DbGovernanceEntityRow {
  id: string;
  kind: string;
  status: string;
  ref_code: string;
  title: string;
  body: string;
  version: number;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbGovernanceTransitionRow {
  id: string;
  entity_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  actor_id: string;
  transitioned_at: string;
}

function rowToEntity(row: DbGovernanceEntityRow): GovernanceEntity {
  return {
    id: row.id,
    kind: row.kind as GovernanceEntity['kind'],
    status: row.status as GovernanceEntity['status'],
    refCode: row.ref_code,
    title: row.title,
    body: row.body,
    version: row.version,
    parentId: row.parent_id,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToTransition(row: DbGovernanceTransitionRow): GovernanceTransition {
  return {
    id: row.id,
    entityId: row.entity_id,
    fromStatus: row.from_status as GovernanceTransition['fromStatus'],
    toStatus: row.to_status as GovernanceTransition['toStatus'],
    reason: row.reason,
    actorId: row.actor_id,
    transitionedAt: new Date(row.transitioned_at),
  };
}

export function createGovernanceKernelService(
  db: GovernanceKernelDb,
  emitter?: CharterEventEmitter,
): GovernanceKernelService {
  return {
    async create(input) {
      assertNonEmpty(input.refCode, 'refCode');
      assertMaxLength(input.refCode, 'refCode', 100);
      assertNonEmpty(input.title, 'title');
      assertMaxLength(input.title, 'title', 255);
      assertMaxLength(input.body, 'body', 100_000);
      assertNonEmpty(input.createdBy, 'createdBy');

      const now = new Date().toISOString();
      const row = await db.insertEntity({
        id: crypto.randomUUID(),
        kind: input.kind,
        status: 'draft',
        ref_code: input.refCode,
        title: input.title,
        body: input.body,
        version: 1,
        parent_id: input.parentId ?? null,
        created_by: input.createdBy,
        created_at: now,
        updated_at: now,
      });
      const entity = rowToEntity(row);

      if (emitter) {
        await emitter.emit({
          eventType: 'charter.entity.created',
          payload: { entityId: entity.id, kind: entity.kind, refCode: entity.refCode },
          idempotencyKey: `charter.entity.created:${entity.id}`,
          correlationId: input.correlationId ?? entity.id,
        });
      }

      return entity;
    },

    async getById(id) {
      const row = await db.findEntityById(id);
      return row ? rowToEntity(row) : null;
    },

    async getByRefCode(refCode) {
      const row = await db.findEntityByRefCode(refCode);
      return row ? rowToEntity(row) : null;
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryEntities({ ...filter, limit, offset });
      return rows.map(rowToEntity);
    },

    async update(id, input) {
      const patch: Partial<DbGovernanceEntityRow> = {
        updated_at: new Date().toISOString(),
      };
      if (input.title !== undefined) patch.title = input.title;
      if (input.body !== undefined) patch.body = input.body;
      const row = await db.updateEntity(id, patch);
      return rowToEntity(row);
    },

    async transition(input) {
      assertNonEmpty(input.entityId, 'entityId');
      assertNonEmpty(input.actorId, 'actorId');

      const entity = await db.findEntityById(input.entityId);
      if (!entity) throw new Error(`Governance entity not found: ${input.entityId}`);

      const transitionRow = await db.insertTransition({
        id: crypto.randomUUID(),
        entity_id: input.entityId,
        from_status: entity.status,
        to_status: input.toStatus,
        reason: input.reason ?? null,
        actor_id: input.actorId,
        transitioned_at: new Date().toISOString(),
      });

      await db.updateEntity(input.entityId, {
        status: input.toStatus,
        updated_at: new Date().toISOString(),
      });

      const transition = rowToTransition(transitionRow);

      if (emitter) {
        await emitter.emit({
          eventType: 'charter.governance.transitioned',
          payload: {
            entityId: transition.entityId,
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
            actorId: transition.actorId,
          },
          idempotencyKey: `charter.governance.transitioned:${transition.id}`,
          correlationId: input.correlationId ?? input.entityId,
        });
      }

      return transition;
    },
  };
}
