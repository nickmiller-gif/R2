#!/usr/bin/env node
/**
 * Break-test Eigen r2-signal-ingest the same way CentralR2 ai-health-check does.
 * Never prints bearer or HMAC values.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickHmacSecret, normalizeBearer, diagnoseBearer } from './lib/pick-ingest-env.mjs';
import { signBodyHmacHex } from './lib/normalize-hmac-secret.mjs';

const r2Root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

load(join(r2Root, '.env.wave1.local'));

const url =
  process.env.R2_SIGNAL_INGEST_URL ??
  'https://zudslxucibosjwefojtm.supabase.co/functions/v1/r2-signal-ingest';
const bearer = normalizeBearer(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
const hmac = pickHmacSecret(r2Root);
const diag = diagnoseBearer(bearer);

console.log('=== probe-r2-signal-ingest (CentralR2-shaped) ===');
console.log('bearer_diagnostic:', diag);
console.log('hmac_configured:', Boolean(hmac));

if (diag !== 'ok' || !hmac) {
  process.exit(2);
}

const body = JSON.stringify({ contract_version: '1.0.0' });
const sig = signBodyHmacHex(hmac, body);
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
    'x-r2-signature': sig,
    'x-idempotency-key': `probe:${Date.now()}`,
  },
  body,
});
const text = await res.text();
console.log('status:', res.status);
console.log('body_snippet:', text.slice(0, 200));
const ok = res.status === 400 || res.status === 202;
console.log(ok ? 'PASS (auth accepted)' : 'FAIL');
process.exit(ok ? 0 : 1);
