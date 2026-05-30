#!/usr/bin/env node
/**
 * Trigger the REGENT Paralegal scheduling bot (live Eigen-derived world-state).
 *
 *   node scripts/run-autonomous-paralegal-schedule.mjs
 */

import { randomUUID } from 'node:crypto';
import { requireBotServiceToken } from './lib/resolve-bot-service-token.mjs';

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const { token, source: tokenSource } = requireBotServiceToken(
  'REGENT_REVIEW_SERVICE_TOKEN',
  'INFORMATION_AUDIT_SERVICE_TOKEN',
  'AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN',
);

const idempotencyKey =
  process.env.PARALEGAL_IDEM_KEY?.trim() ??
  `cli-paralegal:${new Date().toISOString().slice(0, 13)}:${randomUUID()}`;

const res = await fetch(`${EIGEN_URL}/functions/v1/autonomous-paralegal-schedule`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-idempotency-key': idempotencyKey,
  },
  body: JSON.stringify({}),
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
