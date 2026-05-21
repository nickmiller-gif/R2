#!/usr/bin/env node
/**
 * Close-out smokes — auth/ingest path only; rows are labeled [SMOKE] and closeout_smoke.
 * Does NOT prove Tower/IP/Friction live producers (use kb-connectivity-verify.mjs).
 *
 * Usage:
 *   cd R2 && op run --env-file=op.env -- node scripts/kb-closeout-smoke.mjs
 */
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signBodyHmacHex } from './lib/normalize-hmac-secret.mjs';
import { pickHmacSecret, normalizeBearer, diagnoseBearer } from './lib/pick-ingest-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const r2Root = join(__dirname, '..');
const workspaceRoot = join(r2Root, '..');

function loadEnvFile(path, { override = false } = {}) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (override || !process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(join(workspaceRoot, '.env'));
loadEnvFile(join(r2Root, '.env.wave1.local'));
if (existsSync(join(r2Root, 'op.env'))) loadEnvFile(join(r2Root, 'op.env'));
loadEnvFile(join(r2Root, '.env.bridge-sync.local'));

const ingestUrl =
  process.env.R2_SIGNAL_INGEST_URL ??
  'https://zudslxucibosjwefojtm.supabase.co/functions/v1/r2-signal-ingest';
const bearer = normalizeBearer(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
const hmac = pickHmacSecret(r2Root);
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (diagnoseBearer(bearer) !== 'ok' || !hmac) {
  console.error(
    'Need Eigen service_role bearer + R2_SIGNAL_INGEST_HMAC_SECRET (op run --env-file=op.env)',
  );
  process.exit(2);
}

async function emit(label, envelope, idemPrefix) {
  const idem = `${idemPrefix}:${Date.now()}`;
  const body = JSON.stringify(envelope);
  const sig = signBodyHmacHex(hmac, body);
  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      apikey: anon,
      'Content-Type': 'application/json',
      'x-r2-signature': sig,
      'x-idempotency-key': idem,
    },
    body,
  });
  const text = await res.text();
  console.log(label, res.status, text.slice(0, 160));
  if (!res.ok) process.exit(1);
  try {
    return JSON.parse(text).signal_id;
  } catch {
    return null;
  }
}

const eventTime = new Date().toISOString();
const runId = crypto.randomUUID();

const probes = [
  [
    'centralr2',
    {
      contract_version: '1.0.0',
      source_system: 'centralr2',
      source_repo: 'nickmiller-gif/centralr2-core',
      source_event_type: 'stream_a_closeout',
      actor_meg_entity_id: null,
      related_entity_ids: [],
      event_time: eventTime,
      summary: '[SMOKE] Stream A closeout — Eigen ingest path verification (not real app traffic)',
      raw_payload: {
        closeout: true,
        ingest_run: {
          id: runId,
          source_system: 'centralr2',
          started_at: eventTime,
          trigger: 'stream_a_closeout',
        },
      },
      confidence: 0.72,
      privacy_level: 'operator',
      provenance: { closeout_smoke: true, probe: 'kb-closeout-smoke' },
      routing_targets: ['oracle', 'operator_workbench'],
      ingest_run_id: runId,
    },
    'centralr2:closeout',
  ],
  [
    'friction_zero',
    {
      contract_version: '1.0.0',
      source_system: 'friction_zero',
      source_repo: 'nickmiller-gif/operator-workbench',
      source_event_type: 'friction_collapse_emitted',
      actor_meg_entity_id: null,
      related_entity_ids: [],
      event_time: eventTime,
      summary:
        '[SMOKE] Friction Zero closeout — dossier emit path verification (not real app traffic)',
      raw_payload: {
        closeout: true,
        collapse_thesis:
          'Agent-native transaction console compresses buyer-representation friction.',
        evidence_tier: 'operator_analyst',
        policy_tags: ['operator', 'real_estate'],
      },
      confidence: 0.68,
      privacy_level: 'operator',
      provenance: { closeout_smoke: true, module: 'operator-workbench' },
      routing_targets: ['oracle', 'operator_workbench', 'eigen'],
      ingest_run_id: runId,
    },
    'friction-zero:closeout',
  ],
  [
    'ip_pulse_point',
    {
      contract_version: '1.0.0',
      source_system: 'ip_pulse_point',
      source_repo: 'nickmiller-gif/ip-pulse-point',
      source_event_type: 'patent_analysis_complete',
      actor_meg_entity_id: null,
      related_entity_ids: [],
      event_time: eventTime,
      summary: '[SMOKE] IP closeout — analysis-shaped envelope (not real app traffic)',
      raw_payload: {
        closeout: true,
        analysis_id: `closeout-${runId}`,
        ingest_run: {
          id: runId,
          source_system: 'ip_pulse_point',
          started_at: eventTime,
          trigger: 'patent_analysis_complete',
        },
      },
      confidence: 0.7,
      privacy_level: 'operator',
      provenance: {
        closeout_smoke: true,
        note: 'Simulates ip-router bridge shape; live IP still needs ip-router redeploy',
      },
      routing_targets: ['oracle'],
      ingest_run_id: runId,
    },
    'ip-pulse-point:closeout',
  ],
];

const signalIds = {};
for (const [label, envelope, idem] of probes) {
  signalIds[label] = await emit(label, envelope, idem);
}

console.log('\nSignal IDs:', JSON.stringify(signalIds, null, 2));
console.log('\nVerify on Eigen:');
console.log(
  "SELECT source_system, source_event_type, ingested_at FROM public.platform_feed_items WHERE source_event_type LIKE '%closeout%' OR source_event_type IN ('stream_a_closeout','friction_collapse_emitted','patent_analysis_complete') ORDER BY ingested_at DESC LIMIT 10;",
);
