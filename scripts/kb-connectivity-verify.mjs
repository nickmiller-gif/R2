#!/usr/bin/env node
/**
 * KB-four + spine connectivity verifier (read-only + optional --emit-smokes).
 * Never prints secret values.
 *
 * Usage:
 *   cd R2 && set -a && . ./.env.wave1.local && . ./.env.bridge-sync.local 2>/dev/null; set +a
 *   node scripts/kb-connectivity-verify.mjs
 *   node scripts/kb-connectivity-verify.mjs --emit-smokes
 */
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const r2Root = join(__dirname, '..');
const workspaceRoot = join(r2Root, '..');
const EIGEN_REF = 'zudslxucibosjwefojtm';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DRIVERS = [
  {
    id: 'centralr2',
    label: 'CentralR2 (Stream A)',
    liveTypes: ['knowledge_event', 'client_enriched', 'rental_analysis', 'property_lookup'],
    smokeTypes: ['stream_a_closeout', 'kb_four_smoke', 'r2.signal.ingest.probe'],
  },
  {
    id: 'r2chart',
    label: 'R2Chart',
    liveTypes: ['ingest_probe', 'continuity_signal', 'charter_ingest'],
    smokeTypes: ['kb_four_smoke'],
  },
  {
    id: 'ip_pulse_point',
    label: 'R2-IP',
    liveTypes: ['patent_analysis_complete', 'ip_analysis_complete', 'analysis_complete'],
    smokeTypes: ['kb_four_smoke'],
  },
  {
    id: 'friction_zero',
    label: 'Friction Zero',
    liveTypes: [
      'friction_collapse_emitted',
      'friction_collapse_draft',
      'friction_collapse_validated',
    ],
    smokeTypes: [],
  },
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(join(workspaceRoot, '.env'));
loadEnvFile(join(r2Root, '.env.wave1.local'));
loadEnvFile(join(r2Root, '.env.bridge-sync.local'));

const base = (process.env.SUPABASE_URL ?? `https://${EIGEN_REF}.supabase.co`).replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const emitSmokes = process.argv.includes('--emit-smokes');

if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY via .env.wave1.local');
  process.exit(2);
}

async function fetchLatest(system) {
  const q = new URL(`${base}/rest/v1/platform_feed_items`);
  q.searchParams.set('select', 'id,source_event_type,ingested_at,processing_status,summary');
  q.searchParams.set('source_system', `eq.${system}`);
  q.searchParams.set('order', 'ingested_at.desc');
  q.searchParams.set('limit', '5');
  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { error: `${res.status}` };
  return { rows: await res.json() };
}

function classify(driver, rows) {
  if (!rows?.length) return { status: 'red', reason: 'no rows in platform_feed_items' };
  const latest = rows[0];
  const ingested = new Date(latest.ingested_at).getTime();
  const ageOk = Date.now() - ingested <= MAX_AGE_MS;
  const isLive = driver.liveTypes.some((t) => latest.source_event_type === t);
  const isSmokeOnly = rows.every((r) =>
    [...driver.smokeTypes, 'kb_four_smoke'].includes(r.source_event_type),
  );
  if (isLive && ageOk)
    return { status: 'green', reason: `live ${latest.source_event_type}`, latest };
  if (ageOk && !isSmokeOnly)
    return { status: 'amber', reason: `recent ${latest.source_event_type}`, latest };
  if (ageOk && isSmokeOnly)
    return { status: 'amber', reason: 'smoke/probe only — app producer not proven', latest };
  return {
    status: 'red',
    reason: `stale (latest ${latest.source_event_type} @ ${latest.ingested_at})`,
    latest,
  };
}

async function emitSmoke(system, eventType, summary) {
  const ingestUrl =
    process.env.R2_SIGNAL_INGEST_URL ??
    `https://${EIGEN_REF}.supabase.co/functions/v1/r2-signal-ingest`;
  const hmac = process.env.R2_SIGNAL_INGEST_HMAC_SECRET;
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const eventTime = new Date().toISOString();
  const runId = crypto.randomUUID();
  const envelope = {
    contract_version: '1.0.0',
    source_system: system,
    source_repo: `nickmiller-gif/${system === 'centralr2' ? 'centralr2-core' : system}`,
    source_event_type: eventType,
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: eventTime,
    summary,
    raw_payload: { connectivity_verify: true, ingest_run: { id: runId, trigger: eventType } },
    confidence: 0.7,
    privacy_level: 'operator',
    provenance: { connectivity_verify: true },
    routing_targets: ['oracle', 'operator_workbench'],
    ingest_run_id: runId,
  };
  const body = JSON.stringify(envelope);
  const sig = crypto.createHmac('sha256', hmac).update(body).digest('hex');
  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: anon,
      'Content-Type': 'application/json',
      'x-r2-signature': sig,
      'x-idempotency-key': `connectivity:${system}:${Date.now()}`,
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 120) };
}

async function checkHttp(label, url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    return { label, code: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (e) {
    return { label, code: 0, ok: false, error: e.message };
  }
}

console.log('=== KB connectivity verify ===\n');

const httpChecks = await Promise.all([
  checkHttp('r2works /today', 'https://r2works.com/today'),
  checkHttp('centralr2.com', 'https://centralr2.com'),
  checkHttp('r2chart.com', 'https://r2chart.com'),
  checkHttp('r2-ip vanity', 'https://r2-ip.com'),
]);

console.log('HTTP fronts:');
for (const h of httpChecks) {
  console.log(`  ${h.ok ? '✓' : '✗'} ${h.label} → ${h.code || h.error}`);
}

async function fetchMegCount() {
  const q = new URL(`${base}/rest/v1/meg_entities`);
  q.searchParams.set('select', 'id');
  q.searchParams.set('limit', '1');
  const head = await fetch(q, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });
  const range = head.headers.get('content-range');
  if (range) {
    const m = range.match(/\/(\d+)$/);
    if (m) return Number(m[1]);
  }
  const res = await fetch(q, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) return null;
  const range2 = res.headers.get('content-range');
  const m2 = range2?.match(/\/(\d+)$/);
  return m2 ? Number(m2[1]) : 0;
}

async function fetchMegActorCoverage() {
  const q = new URL(`${base}/rest/v1/platform_feed_items`);
  q.searchParams.set('select', 'actor_meg_entity_id');
  q.searchParams.set('order', 'ingested_at.desc');
  q.searchParams.set('limit', '200');
  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return { sampled: 0, withActor: 0 };
  const withActor = rows.filter((r) => r.actor_meg_entity_id).length;
  return { sampled: rows.length, withActor };
}

const megCount = await fetchMegCount();
const megActor = await fetchMegActorCoverage();
if (megCount === null) {
  console.log('\nMEG: query failed (meg_entities)');
} else if (megCount === 0) {
  console.log('\nMEG: meg_entities count = 0 — run meg-backfill-platform-feed-smoke.sh when ready');
} else {
  console.log(`\nMEG: meg_entities count = ${megCount}`);
}
if (megActor) {
  const pct = megActor.sampled > 0 ? Math.round((100 * megActor.withActor) / megActor.sampled) : 0;
  console.log(
    `MEG: actor_meg_entity_id on last ${megActor.sampled} feed rows: ${megActor.withActor} (${pct}%)`,
  );
}

console.log('\nEigen platform_feed_items (per driver):');
let reds = 0;
for (const driver of DRIVERS) {
  const { rows, error } = await fetchLatest(driver.id);
  if (error) {
    console.log(`  ✗ ${driver.label}: query failed (${error})`);
    reds++;
    continue;
  }
  const c = classify(driver, rows);
  const icon = c.status === 'green' ? '✓' : c.status === 'amber' ? '!' : '✗';
  if (c.status === 'red') reds++;
  const tail = c.latest
    ? ` — ${c.latest.source_event_type} @ ${c.latest.ingested_at} [${c.latest.processing_status}]`
    : '';
  console.log(`  ${icon} ${driver.label}: ${c.reason}${tail}`);
}

if (emitSmokes) {
  console.log('\nEmitting connectivity smokes…');
  for (const [sys, type, sum] of [
    ['centralr2', 'knowledge_event', 'Connectivity verify — CentralR2-shaped knowledge_event'],
    ['r2chart', 'ingest_probe', 'Connectivity verify R2Chart ingest_probe'],
    ['ip_pulse_point', 'patent_analysis_complete', 'Connectivity verify IP-shaped'],
    ['friction_zero', 'friction_collapse_emitted', 'Connectivity verify friction_zero'],
  ]) {
    const r = await emitSmoke(sys, type, sum);
    console.log(`  ${sys} ${type}: HTTP ${r.status} ${r.text}`);
  }
}

console.log(`\nSummary: ${reds} driver(s) need live app traffic (not just CLI smokes).`);
console.log(
  'Operator read path: r2works.com/today → platform_feed_items (realtime + source filter).',
);
process.exit(reds > 0 ? 1 : 0);
