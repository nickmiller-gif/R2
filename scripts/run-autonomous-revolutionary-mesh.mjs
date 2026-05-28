#!/usr/bin/env node
/**
 * Trigger a full revolutionary bot mesh cycle (KB-four RSS scouts + cross-domain synthesis).
 *
 * Usage:
 *   node scripts/run-autonomous-revolutionary-mesh.mjs
 *
 * Env: EIGEN_SUPABASE_URL or SUPABASE_URL; REVOLUTIONARY_MESH_SERVICE_TOKEN or
 *      AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN; optional x-idempotency-key via MESH_IDEM_KEY.
 */

import { requireBotServiceToken } from './lib/resolve-bot-service-token.mjs';

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const { token, source: tokenSource } = requireBotServiceToken(
  'REVOLUTIONARY_MESH_SERVICE_TOKEN',
  'AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN',
);

const idempotencyKey =
  process.env.MESH_IDEM_KEY?.trim() ?? `cli-mesh:${new Date().toISOString().slice(0, 13)}`;

const res = await fetch(`${EIGEN_URL}/functions/v1/autonomous-revolutionary-mesh`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-idempotency-key': idempotencyKey,
  },
  body: '{}',
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log(JSON.stringify({ status: res.status, idempotencyKey, tokenSource, body }, null, 2));
process.exit(res.ok ? 0 : 1);
