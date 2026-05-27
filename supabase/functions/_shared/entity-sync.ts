/**
 * Cross-site entity field sync — apply entity_field_update signals on Eigen.
 */
import {
  ENTITY_FIELD_UPDATE_EVENT_TYPE,
  ENTITY_UPDATED_PROJECTION_EVENT_TYPE,
  buildEntityUpdateSummary,
  computeEntityUpdateSignalKey,
  isEntityFieldUpdateEvent,
  isEntityUpdatedProjectionEvent,
  isUuid,
  parseEntityUpdatePayload,
  type EntitySyncFieldPatch,
  type R2EntityUpdatePayload,
} from '../../../packages/r2-signal-contract/src/entity-update.ts';
import type { R2SignalEnvelope } from '../../../packages/r2-signal-contract/src/v1.ts';

export {
  ENTITY_FIELD_UPDATE_EVENT_TYPE,
  ENTITY_UPDATED_PROJECTION_EVENT_TYPE,
  isEntityFieldUpdateEvent,
  isEntityUpdatedProjectionEvent,
};

export function isEntityCrossSiteSyncEnabled(): boolean {
  const flag = Deno.env.get('ENABLE_ENTITY_CROSS_SITE_SYNC')?.trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

type FeedRowLike = {
  id: string;
  source_system: string;
  source_event_type: string;
  event_time: string;
  summary: string;
  payload: Record<string, unknown>;
  source_signal_key?: string | null;
};

type SupabaseClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
      match: (filter: Record<string, string>) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function resolveMegEntityIdForUpdate(
  client: SupabaseClient,
  update: R2EntityUpdatePayload,
  sourceSystem?: string,
): Promise<string | null> {
  if (isUuid(update.meg_entity_id)) return update.meg_entity_id;
  if (!update.source_table || !update.source_row_id) return null;

  const filter: Record<string, string> = {
    source_table: update.source_table,
    source_row_id: update.source_row_id,
  };
  if (sourceSystem) filter.source_system = sourceSystem;

  const ref = await client
    .from('meg_entity_source_refs')
    .select('meg_entity_id')
    .match(filter)
    .maybeSingle();
  if (ref.error) throw new Error(ref.error.message);
  const megId = ref.data?.meg_entity_id;
  return typeof megId === 'string' && isUuid(megId) ? megId : null;
}

export type ApplyEntityUpdateResult = {
  applied: boolean;
  reason?: string;
  megEntityId?: string;
  fields?: Record<string, unknown>;
};

export async function applyEntityFieldUpdateFromFeedRow(
  client: SupabaseClient,
  row: FeedRowLike,
): Promise<ApplyEntityUpdateResult> {
  if (!isEntityCrossSiteSyncEnabled()) {
    return { applied: false, reason: 'feature_disabled' };
  }
  if (!isEntityFieldUpdateEvent(row.source_event_type)) {
    return { applied: false, reason: 'not_entity_update' };
  }

  const update = parseEntityUpdatePayload(row.payload);
  if (!update) return { applied: false, reason: 'invalid_payload' };

  const megEntityId = await resolveMegEntityIdForUpdate(client, update, row.source_system);
  if (!megEntityId) return { applied: false, reason: 'meg_entity_unresolved' };

  const patchJson: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(update.field_patch)) {
    patchJson[k] = v ?? null;
  }

  const { data, error } = await client.rpc('apply_meg_entity_projection_patch', {
    p_meg_entity_id: megEntityId,
    p_field_patch: patchJson,
    p_source_revision: update.source_revision,
    p_event_time: row.event_time,
    p_source_system: row.source_system,
    p_source_signal_key: row.source_signal_key ?? null,
  });
  if (error) throw new Error(`apply_meg_entity_projection_patch: ${error.message}`);

  const result = data as Record<string, unknown> | null;
  return {
    applied: Boolean(result?.applied),
    reason: typeof result?.reason === 'string' ? result.reason : undefined,
    megEntityId,
    fields: isRecord(result?.fields) ? result.fields : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildEntityUpdatedProjectionEnvelope(
  row: FeedRowLike,
  megEntityId: string,
  fields: EntitySyncFieldPatch | Record<string, unknown>,
): R2SignalEnvelope {
  const eventTime = new Date().toISOString();
  const revision = `projection:${row.id}`;
  return {
    contract_version: '1.0.0',
    source_system: 'r2_widget',
    source_repo: 'nickmiller-gif/R2',
    source_event_type: ENTITY_UPDATED_PROJECTION_EVENT_TYPE,
    actor_meg_entity_id: megEntityId,
    related_entity_ids: [megEntityId],
    event_time: eventTime,
    summary: buildEntityUpdateSummary(fields as EntitySyncFieldPatch, row.source_system),
    raw_payload: {
      entity_projection: true,
      meg_entity_id: megEntityId,
      fields,
      source_feed_item_id: row.id,
      source_system: row.source_system,
      source_revision: revision,
    },
    confidence: 1,
    privacy_level: 'operator',
    provenance: {
      table: 'platform_feed_items',
      row_id: row.id,
      projection_emit: true,
    },
    routing_targets: ['operator_workbench', 'eigen', 'meg'],
  };
}

export function entityUpdatedProjectionSignalKey(sourceFeedItemId: string): string {
  return computeEntityUpdateSignalKey(
    'r2_widget',
    sourceFeedItemId,
    `projection:${sourceFeedItemId}`,
  );
}

type InsertClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/** Inserts canonical `entity_updated` projection row (idempotent on source_signal_key). */
export async function emitEntityUpdatedProjection(
  client: InsertClient,
  row: FeedRowLike,
  megEntityId: string,
  fields: Record<string, unknown>,
): Promise<string | null> {
  const envelope = buildEntityUpdatedProjectionEnvelope(row, megEntityId, fields);
  const sourceSignalKey = entityUpdatedProjectionSignalKey(row.id);
  const insertRow = {
    contract_version: envelope.contract_version,
    source_system: envelope.source_system,
    source_repo: envelope.source_repo,
    source_event_type: envelope.source_event_type,
    source_signal_key: sourceSignalKey,
    actor_meg_entity_id: envelope.actor_meg_entity_id,
    related_entity_ids: envelope.related_entity_ids,
    event_time: envelope.event_time,
    summary: envelope.summary,
    payload: envelope.raw_payload,
    confidence: envelope.confidence,
    privacy_level: envelope.privacy_level,
    provenance: envelope.provenance,
    routing_targets: envelope.routing_targets,
    processing_status: 'published',
    processed_at: new Date().toISOString(),
  };

  const ins = await client.from('platform_feed_items').insert(insertRow).select('id').single();
  if (!ins.error && ins.data?.id) return ins.data.id;

  if (ins.error?.code === '23505') {
    const existing = await client
      .from('platform_feed_items')
      .select('id')
      .eq('source_signal_key', sourceSignalKey)
      .maybeSingle();
    if (!existing.error && existing.data?.id) return existing.data.id;
  }
  if (ins.error) {
    throw new Error(`entity-sync projection insert failed: ${ins.error.message}`);
  }
  return null;
}
