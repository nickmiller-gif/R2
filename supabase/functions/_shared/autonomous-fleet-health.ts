/**
 * REGENT fleet-health watchdog — runtime glue.
 *
 * The pure assessor lives in @r2/regent/src/fleet.ts. This adds the live reads
 * (processing failures / deadletter backlog) and the single advisory side
 * effect: emit a `fleet_health_report` signal. Reports; never restarts.
 */

import { buildSourceSignalKey } from './signal-utils.ts';
import { getServiceClient } from './supabase.ts';
import {
  assessFleetHealth,
  type FleetHealthReport,
} from '../../../packages/r2-regent/src/fleet.ts';
import type { AgentActivity } from '../../../packages/r2-regent/src/review.ts';

export { assessFleetHealth, type FleetHealthReport };

/** Count signals stuck in failure / deadletter so the watchdog can alert on backlog. */
export async function fetchFleetFailureCounts(
  client: ReturnType<typeof getServiceClient>,
): Promise<{ failedSignals: number; deadletterBacklog: number }> {
  const c = client as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
  const failed = await c
    .from('platform_feed_items')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'failed');
  const deadletter = await c
    .from('platform_feed_items')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'deadletter');
  return {
    failedSignals: failed.error ? 0 : (failed.count ?? 0),
    deadletterBacklog: deadletter.error ? 0 : (deadletter.count ?? 0),
  };
}

export async function emitFleetHealthSignal(input: {
  idempotencyKey: string;
  report: FleetHealthReport;
}): Promise<{ signal_id: string | null; status: number }> {
  const { report } = input;
  const sourceSystem = 'autonomous_bot_os';
  const envelope = {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: 'nickmiller-gif/R2',
    source_event_type: 'fleet_health_report',
    actor_meg_entity_id: null,
    related_entity_ids: [] as string[],
    event_time: new Date().toISOString(),
    summary: report.healthy
      ? `Fleet health: all ${report.bots.length} bots healthy`
      : `Fleet health: ${report.alerts.length} alert(s) — ${report.alerts[0]}`,
    raw_payload: {
      finding_kind: 'fleet_health_report',
      generator: 'autonomous-fleet-health',
      advisory_only: true,
      healthy: report.healthy,
      bots: report.bots,
      missing: report.missing,
      failed_signals: report.failed_signals,
      deadletter_backlog: report.deadletter_backlog,
      alerts: report.alerts,
    },
    confidence: report.healthy ? 0.95 : 0.9,
    privacy_level: 'operator',
    provenance: { tool: 'autonomous-fleet-health', generated_at: new Date().toISOString() },
    routing_targets: ['operator_workbench'],
  };

  const sourceSignalKey = buildSourceSignalKey(
    sourceSystem,
    `fleet_health:${input.idempotencyKey}`,
  );
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
    throw new Error(insertResult.error?.message ?? 'Failed to insert fleet health signal');
  }

  const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
  if (enqueue.error) throw new Error(enqueue.error.message);
  return { signal_id: signalId, status: 202 };
}

export type { AgentActivity };
