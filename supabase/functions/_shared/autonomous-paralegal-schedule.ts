/**
 * REGENT Paralegal — autonomous scheduling bot (runtime glue).
 *
 * The pure scheduler lives in @r2/regent/src/paralegal.ts. This module adds the
 * one advisory side effect: emit a `paralegal_schedule_published` signal listing
 * the recurring obligations and deadlines that are overdue / due soon / upcoming.
 */

import { buildSourceSignalKey } from './signal-utils.ts';
import { getServiceClient } from './supabase.ts';
import {
  buildParalegalSchedule,
  type ParalegalSchedule,
} from '../../../packages/r2-regent/src/paralegal.ts';
import type { WorldState } from '../../../packages/r2-regent/src/review.ts';

export { buildParalegalSchedule, type ParalegalSchedule };

export async function emitParalegalScheduleSignal(input: {
  idempotencyKey: string;
  schedule: ParalegalSchedule;
}): Promise<{ signal_id: string | null; status: number }> {
  const { schedule } = input;
  const sourceSystem = 'autonomous_bot_os';
  const nextUp = schedule.items.find((i) => i.status !== 'upcoming') ?? schedule.items[0];

  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'paralegal_schedule_published',
    actor_meg_entity_id: null,
    related_entity_ids: [] as string[],
    event_time: new Date().toISOString(),
    summary:
      `Paralegal schedule: ${schedule.overdue} overdue, ${schedule.due_soon} due soon, ` +
      `${schedule.upcoming} upcoming` +
      (nextUp ? ` — next: ${nextUp.title} (${nextUp.due_date})` : ''),
    raw_payload: {
      finding_kind: 'paralegal_schedule',
      generator: 'autonomous-paralegal-schedule',
      advisory_only: true,
      as_of: schedule.as_of,
      schedule: schedule.items,
      overdue: schedule.overdue,
      due_soon: schedule.due_soon,
      upcoming: schedule.upcoming,
    },
    confidence: 0.9,
    privacy_level: 'operator',
    provenance: { tool: 'autonomous-paralegal-schedule', generated_at: new Date().toISOString() },
    routing_targets: ['operator_workbench'],
  };

  const sourceSignalKey = buildSourceSignalKey(sourceSystem, `paralegal:${input.idempotencyKey}`);
  const client =
    getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;

  const insertResult = await client
    .from('platform_feed_items')
    .insert({
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
    })
    .select('id')
    .single();

  let signalId: string | null = null;
  if (!insertResult.error && insertResult.data?.id) {
    signalId = insertResult.data.id as string;
  } else if (insertResult.error && (insertResult.error as { code?: string }).code === '23505') {
    const existing = await client
      .from('platform_feed_items')
      .select('id')
      .eq('source_signal_key', sourceSignalKey)
      .maybeSingle();
    if (existing.error || !existing.data?.id) {
      throw new Error(existing.error?.message ?? 'Failed to resolve idempotent replay');
    }
    signalId = existing.data.id as string;
  } else {
    throw new Error(insertResult.error?.message ?? 'Failed to insert paralegal schedule signal');
  }

  const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
  if (enqueue.error) throw new Error(enqueue.error.message);

  return { signal_id: signalId, status: 202 };
}

export type { WorldState };
