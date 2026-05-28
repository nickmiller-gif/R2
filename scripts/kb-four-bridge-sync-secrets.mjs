#!/usr/bin/env node
/**
 * Sync KB-four bridge secrets onto Eigen (continuity-ingest-signal bridge).
 * Tower/CentralR2 (ukffrvqainkntdgjzyde) and IP (jgglfgzvjcbqvnonmldr) may require
 * Dashboard/Lovable fallback when Supabase CLI returns 403 (not authorized).
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN (sbp_…) in env — use umbrella .env, not wave1 invalid token
 *   R2/.env.wave1.local — SUPABASE_SERVICE_ROLE_KEY (Eigen service role JWT)
 *   R2/.env.bridge-sync.local — R2_SIGNAL_INGEST_HMAC_SECRET (+ URL); generate via openssl rand -hex 32
 *
 * Usage:
 *   node R2/scripts/kb-four-bridge-sync-secrets.mjs
 *   node R2/scripts/kb-four-bridge-sync-secrets.mjs --smoke
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnoseBearer, normalizeBearer, pickHmacSecret } from './lib/pick-ingest-env.mjs';

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

// wave1 / op.env first; bridge-sync fills gaps only (bad HMAC must not override 1Password)
loadEnvFile(join(workspaceRoot, '.env'));
loadEnvFile(join(r2Root, '.env.wave1.local'));
if (existsSync(join(r2Root, 'op.env'))) loadEnvFile(join(r2Root, 'op.env'));
loadEnvFile(join(r2Root, '.env.bridge-sync.local'));

const EIGEN_REF = 'zudslxucibosjwefojtm';
const TOWER_REF = 'ukffrvqainkntdgjzyde';
const IP_REF = 'jgglfgzvjcbqvnonmldr';
const ingestUrl =
  process.env.R2_SIGNAL_INGEST_URL ??
  `https://${EIGEN_REF}.supabase.co/functions/v1/r2-signal-ingest`;
const bearer = normalizeBearer(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
const hmac = pickHmacSecret(r2Root);
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

const token = accessToken?.trim().replace(/^["']|["']$/g, '');
if (!token?.startsWith('sbp_')) {
  console.error('Set SUPABASE_ACCESS_TOKEN (sbp_…) in umbrella .env — not the service role JWT.');
  process.exit(2);
}
const bearerDiag = diagnoseBearer(bearer);
if (bearerDiag !== 'ok') {
  console.error(
    `Eigen service role bearer invalid (${bearerDiag}). Fix R2/.env.wave1.local SUPABASE_SERVICE_ROLE_KEY.`,
  );
  process.exit(2);
}
if (!bearer || !hmac) {
  console.error(
    'Need valid SUPABASE_SERVICE_ROLE_KEY (wave1/op) and R2_SIGNAL_INGEST_HMAC_SECRET (byte-identical to Eigen).',
  );
  process.exit(2);
}
console.log('Bearer diagnostic: ok (Eigen service_role ref)');
console.log(`HMAC: selected (${hmac.length} chars, UTF-8 signing — not hex-decoded)`);

function setSecrets(projectRef, { bridge = true, ingest = false } = {}) {
  const flags = [];
  if (bridge) flags.push('ENABLE_R2_SIGNAL_BRIDGE=true');
  if (ingest) flags.push('ENABLE_R2_SIGNAL_INGEST=true');
  const args = [
    'secrets',
    'set',
    '--project-ref',
    projectRef,
    ...flags,
    `R2_SIGNAL_INGEST_URL=${ingestUrl}`,
    `R2_SIGNAL_INGEST_BEARER=${bearer}`,
    `R2_SIGNAL_INGEST_HMAC_SECRET=${hmac}`,
  ];
  const r = spawnSync('npx', ['--yes', 'supabase@2.89.0', ...args], {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  });
  return r.status === 0;
}

function setTowerSecrets() {
  const args = [
    'secrets',
    'set',
    '--project-ref',
    TOWER_REF,
    'ENABLE_R2_SIGNAL_INGEST=true',
    `R2_SIGNAL_INGEST_URL=${ingestUrl}`,
    `R2_SIGNAL_INGEST_BEARER=${bearer}`,
    `R2_SIGNAL_INGEST_HMAC_SECRET=${hmac}`,
  ];
  const r = spawnSync('npx', ['--yes', 'supabase@2.89.0', ...args], {
    stdio: 'pipe',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  });
  const output = `${r.stdout?.toString() ?? ''}\n${r.stderr?.toString() ?? ''}`.trim();
  const outputLower = output.toLowerCase();
  const forbidden =
    r.status !== 0 &&
    (outputLower.includes('403') ||
      outputLower.includes('not authorized') ||
      outputLower.includes('necessary privileges') ||
      outputLower.includes('access-control'));
  return { ok: r.status === 0, forbidden, output };
}

console.log('Setting KB-four bridge on Eigen…');
if (!setSecrets(EIGEN_REF)) process.exit(1);
console.log('Setting Stream A ingest on Tower (CentralR2)…');
const towerResult = setTowerSecrets();
if (!towerResult.ok) {
  if (towerResult.forbidden) {
    console.warn(
      'Tower secrets failed (403 expected) — set ENABLE_R2_SIGNAL_INGEST + ingest URL/bearer/HMAC in Lovable/Dashboard for',
      TOWER_REF,
    );
  } else {
    if (towerResult.output) console.error(towerResult.output);
    process.exit(1);
  }
}
console.log('Setting KB-four bridge on IP project…');
if (!setSecrets(IP_REF, { bridge: true, ingest: true })) {
  console.warn(
    'IP project secrets failed (403 expected) — set the same four keys in Supabase Dashboard for',
    IP_REF,
  );
}

if (!process.argv.includes('--smoke')) {
  console.log('Done. Run with --smoke to emit r2chart + ip_pulse_point probes.');
  process.exit(0);
}

const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
for (const [label, sys, repo] of [
  ['r2chart', 'r2chart', 'nickmiller-gif/continuity-nexus'],
  ['ip_pulse_point', 'ip_pulse_point', 'nickmiller-gif/ip-pulse-point'],
]) {
  const idem = `${label}-smoke:${Date.now()}`;
  const ingestRunUuid = crypto.randomUUID();
  const eventTime = new Date().toISOString();
  const envelope = {
    contract_version: '1.0.0',
    source_system: sys,
    source_repo: repo,
    source_event_type: 'kb_four_smoke',
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: eventTime,
    summary: `KB-four smoke ${label}`,
    raw_payload: {
      smoke: true,
      ingest_run: {
        id: ingestRunUuid,
        source_system: sys,
        started_at: eventTime,
        trigger: 'kb_four_smoke',
      },
    },
    confidence: 0.55,
    privacy_level: 'operator',
    provenance: { probe: true },
    routing_targets: ['oracle'],
    ingest_run_id: ingestRunUuid,
  };
  const body = JSON.stringify(envelope);
  const { signBodyHmacHex } = await import('./lib/normalize-hmac-secret.mjs');
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
  console.log(label, res.status, text.slice(0, 120));
  if (!res.ok) process.exit(1);
}
