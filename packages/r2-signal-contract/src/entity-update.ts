/**
 * Cross-site entity field propagation (R2-IP ↔ R2 Works).
 * Producers emit `entity_field_update`; Eigen processing applies patches and
 * may emit `entity_updated` projection signals.
 */

import type { R2SignalSourceSystem } from './v1.ts';

/** Ingest event type from product repos (ip_pulse_point, operator_workbench). */
export const ENTITY_FIELD_UPDATE_EVENT_TYPE = 'entity_field_update' as const;

/** Canonical projection event emitted by r2-signal-process after apply. */
export const ENTITY_UPDATED_PROJECTION_EVENT_TYPE = 'entity_updated' as const;

/** Syncable scalar fields shared across KB-four client surfaces. */
export const ENTITY_SYNC_FIELD_KEYS = [
  'name',
  'industry',
  'description',
  'website',
  'drug_name',
] as const;

export type EntitySyncFieldKey = (typeof ENTITY_SYNC_FIELD_KEYS)[number];

export type EntitySyncFieldPatch = Partial<Record<EntitySyncFieldKey, string | null>>;

export type R2EntityUpdatePayload = {
  entity_update: true;
  meg_entity_id: string;
  entity_type?: string;
  field_patch: EntitySyncFieldPatch;
  source_revision: string;
  source_table?: string;
  source_row_id?: string;
  actor_user_id?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isEntityFieldUpdateEvent(sourceEventType: string): boolean {
  return sourceEventType === ENTITY_FIELD_UPDATE_EVENT_TYPE;
}

export function isEntityUpdatedProjectionEvent(sourceEventType: string): boolean {
  return sourceEventType === ENTITY_UPDATED_PROJECTION_EVENT_TYPE;
}

/** Fields that must not be overwritten from cross-site sync. */
export const ENTITY_SYNC_PROTECTED_FIELDS = ['governance_scope', 'kind'] as const;

export function parseEntityUpdatePayload(
  raw: Record<string, unknown> | null | undefined,
): R2EntityUpdatePayload | null {
  if (!raw || raw.entity_update !== true) return null;
  const megEntityId = raw.meg_entity_id;
  if (!isUuid(megEntityId)) return null;
  const fieldPatch = raw.field_patch;
  if (!fieldPatch || typeof fieldPatch !== 'object' || Array.isArray(fieldPatch)) return null;
  const sourceRevision =
    typeof raw.source_revision === 'string' && raw.source_revision.trim().length > 0
      ? raw.source_revision.trim()
      : null;
  if (!sourceRevision) return null;

  const patch: EntitySyncFieldPatch = {};
  for (const key of ENTITY_SYNC_FIELD_KEYS) {
    if (!(key in fieldPatch)) continue;
    const v = (fieldPatch as Record<string, unknown>)[key];
    if (v === null || v === undefined) {
      patch[key] = null;
    } else if (typeof v === 'string') {
      patch[key] = v;
    }
  }
  if (Object.keys(patch).length === 0) return null;

  return {
    entity_update: true,
    meg_entity_id: megEntityId,
    entity_type: typeof raw.entity_type === 'string' ? raw.entity_type : undefined,
    field_patch: patch,
    source_revision: sourceRevision,
    source_table: typeof raw.source_table === 'string' ? raw.source_table : undefined,
    source_row_id: typeof raw.source_row_id === 'string' ? raw.source_row_id : undefined,
    actor_user_id:
      raw.actor_user_id === null || typeof raw.actor_user_id === 'string'
        ? (raw.actor_user_id as string | null)
        : undefined,
  };
}

export function buildEntityUpdateRawPayload(input: {
  megEntityId: string;
  fieldPatch: EntitySyncFieldPatch;
  sourceRevision: string;
  entityType?: string;
  sourceTable?: string;
  sourceRowId?: string;
  actorUserId?: string | null;
}): R2EntityUpdatePayload {
  return {
    entity_update: true,
    meg_entity_id: input.megEntityId,
    entity_type: input.entityType,
    field_patch: input.fieldPatch,
    source_revision: input.sourceRevision,
    source_table: input.sourceTable,
    source_row_id: input.sourceRowId,
    actor_user_id: input.actorUserId ?? null,
  };
}

/**
 * Deterministic idempotency key for ingest (`x-idempotency-key` / source_signal_key).
 * One key per entity + revision token.
 */
export function computeEntityUpdateSignalKey(
  sourceSystem: R2SignalSourceSystem | string,
  megEntityId: string,
  sourceRevision: string,
): string {
  return `${sourceSystem}:entity_field_update:${megEntityId}:${sourceRevision}`;
}

export function buildEntityUpdateSummary(
  fieldPatch: EntitySyncFieldPatch,
  sourceSystem: string,
): string {
  const keys = Object.keys(fieldPatch).join(', ');
  const label = keys.length > 0 ? keys : 'fields';
  const raw = `Entity sync (${sourceSystem}): updated ${label}`;
  return raw.length > 280 ? `${raw.slice(0, 277)}…` : raw;
}
