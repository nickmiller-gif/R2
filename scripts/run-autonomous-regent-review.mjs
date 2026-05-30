#!/usr/bin/env node
/**
 * Trigger the REGENT executive review bot (live Eigen-derived world-state).
 *
 *   node scripts/run-autonomous-regent-review.mjs
 *
 * For the richer cross-repo asset review, use regent-publish-world-state.mjs,
 * which assembles a full world-state from the local repo constellation and
 * posts it to the same bot.
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
  process.env.REGENT_IDEM_KEY?.trim() ??
  `cli-regent:${new Date().toISOString().slice(0, 13)}:${randomUUID()}`;

const res = await fetch(`${EIGEN_URL}/functions/v1/autonomous-regent-review`, {
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
