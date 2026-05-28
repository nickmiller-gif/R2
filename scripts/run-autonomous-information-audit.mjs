#!/usr/bin/env node
/**
 * Run autonomous information audit (check KB-four traffic, corpus, MEG gaps).
 *
 *   node scripts/run-autonomous-information-audit.mjs
 *   node scripts/run-autonomous-information-audit.mjs --remediate --emit-clear
 */

import { randomUUID } from 'node:crypto';
import { requireBotServiceToken } from './lib/resolve-bot-service-token.mjs';

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const { token, source: tokenSource } = requireBotServiceToken(
  'INFORMATION_AUDIT_SERVICE_TOKEN',
  'AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN',
);

const autoRemediate = process.argv.includes('--remediate');
const emitWhenClear = process.argv.includes('--emit-clear');
const idempotencyKey =
  process.env.AUDIT_IDEM_KEY?.trim() ??
  `cli-audit:${new Date().toISOString().slice(0, 13)}:${randomUUID()}`;

const res = await fetch(`${EIGEN_URL}/functions/v1/autonomous-information-audit`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-idempotency-key': idempotencyKey,
  },
  body: JSON.stringify({
    enrich_with_llm: true,
    auto_remediate: autoRemediate,
    emit_when_clear: emitWhenClear,
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
