#!/usr/bin/env node
/**
 * Trigger Eigen Steward cross-domain cycle (KB-four pattern detection + briefs).
 *
 *   node scripts/run-autonomous-steward-cycle.mjs
 *   node scripts/run-autonomous-steward-cycle.mjs --llm
 */

import { randomUUID } from 'node:crypto';
import { requireBotServiceToken } from './lib/resolve-bot-service-token.mjs';

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const { token, source: tokenSource } = requireBotServiceToken(
  'STEWARD_CYCLE_SERVICE_TOKEN',
  'AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN',
);

const enrichLlm = process.argv.includes('--llm');
const autoRemediate = process.argv.includes('--auto-remediate');
const dayBucket = new Date().toISOString().slice(0, 10);
const idempotencyKey =
  process.env.STEWARD_IDEM_KEY?.trim() ?? `cli-steward:${dayBucket}:${randomUUID()}`;

const res = await fetch(`${EIGEN_URL}/functions/v1/autonomous-steward-cycle`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-idempotency-key': idempotencyKey,
  },
  body: JSON.stringify({
    enrich_with_llm: enrichLlm,
    skip_pre_audit: false,
    emit_when_empty: false,
    auto_remediate: autoRemediate,
  }),
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
