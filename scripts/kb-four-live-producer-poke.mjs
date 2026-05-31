#!/usr/bin/env node
/**
 * Emit live-shaped KB-four producer rows (NOT kb_four_smoke / connectivity_verify).
 * Use after HMAC sync to refresh platform_feed_items for kb-connectivity-verify.
 *
 *   cd R2 && op run --env-file=op.env -- node scripts/kb-four-live-producer-poke.mjs
 */
import crypto from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signBodyHmacHex } from './lib/normalize-hmac-secret.mjs';
import { pickHmacSecret, normalizeBearer, diagnoseBearer } from './lib/pick-ingest-env.mjs';

const r2Root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EIGEN_REF = 'zudslxucibosjwefojtm';

const ingestUrl =
  process.env.R2_SIGNAL_INGEST_URL ??
  `https://${EIGEN_REF}.supabase.co/functions/v1/r2-signal-ingest`;
const bearer = normalizeBearer(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
const hmac = pickHmacSecret(r2Root);
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

if (diagnoseBearer(bearer) !== 'ok' || !hmac) {
  console.error('Need Eigen service_role bearer + HMAC (op run --env-file=op.env).');
  process.exit(2);
}

const DRIVERS = [
  {
    label: 'CentralR2',
    source_system: 'centralr2',
    source_repo: 'nickmiller-gif/centralr2-core',
    source_event_type: 'client_enriched',
    summary: 'Live producer poke: CentralR2 client_enriched (post-HMAC sync)',
  },
  {
    label: 'R2Chart',
    source_system: 'r2chart',
    source_repo: 'nickmiller-gif/continuity-nexus',
    source_event_type: 'continuity_signal',
    summary: 'Live producer poke: R2Chart continuity_signal (post-HMAC sync)',
  },
  {
    label: 'R2-IP',
    source_system: 'ip_pulse_point',
    source_repo: 'nickmiller-gif/ip-pulse-point',
    source_event_type: 'patent_analysis_complete',
    summary: 'Live producer poke: IP patent_analysis_complete (post-HMAC sync)',
  },
  {
    label: 'Friction Zero',
    source_system: 'friction_zero',
    source_repo: 'nickmiller-gif/operator-workbench',
    source_event_type: 'friction_collapse_emitted',
    summary: 'Live producer poke: Friction Zero friction_collapse_emitted (post-HMAC sync)',
  },
];

async function emit(driver) {
  const eventTime = new Date().toISOString();
  const runId = crypto.randomUUID();
  const idem = `live-poke:${driver.source_system}:${Date.now()}`;
  const envelope = {
    contract_version: '1.0.0',
    source_system: driver.source_system,
    source_repo: driver.source_repo,
    source_event_type: driver.source_event_type,
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: eventTime,
    summary: driver.summary,
    raw_payload: {
      live_producer_poke: true,
      poke_at: eventTime,
      ingest_run: {
        id: runId,
        source_system: driver.source_system,
        started_at: eventTime,
        trigger: 'kb_four_live_producer_poke',
      },
    },
    confidence: 0.72,
    privacy_level: 'operator',
    provenance: {
      script: 'kb-four-live-producer-poke.mjs',
      function_name: 'kb-four-live-producer-poke',
    },
    routing_targets: ['oracle', 'operator_workbench'],
    ingest_run_id: runId,
  };
  const body = JSON.stringify(envelope);
  const sig = signBodyHmacHex(hmac, body);
  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      ...(anon ? { apikey: anon } : {}),
      'Content-Type': 'application/json',
      'x-r2-signature': sig,
      'x-idempotency-key': idem,
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 160) };
}

console.log('=== kb-four-live-producer-poke ===');
let failed = 0;
for (const driver of DRIVERS) {
  const r = await emit(driver);
  const ok = r.status === 202 || r.status === 200;
  console.log(
    `${ok ? '✓' : '✗'} ${driver.label} (${driver.source_event_type}): HTTP ${r.status} ${r.text}`,
  );
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
