#!/usr/bin/env node
/**
 * POST one Wave-1-shaped envelope with top-level `ingest_run_id` omitted so
 * `r2-signal-ingest` defaults the column from `raw_payload.ingest_run.id` and
 * stamps `provenance._r2.ingest_run_source = wave1_payload`.
 *
 * Production auth: service role + body HMAC (same as producers). Set:
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<R2 project service_role JWT from Dashboard → API>
 *   R2_SIGNAL_INGEST_HMAC_SECRET=<must match R2 edge secret>
 *
 * Optional: SMOKE_IDEMPOTENCY_KEY=... (default: time-based).
 *
 * Note: Dashboard "anon" / legacy API keys are JWTs with `iss: "supabase"` and
 * no `sub`; `guardAuth` requires a user session JWT with `sub`, so use
 * service-role + HMAC here unless you pass a real signed-in user access token.
 */
import crypto from 'node:crypto';

const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const idem =
  (process.env.SMOKE_IDEMPOTENCY_KEY || '').trim() || `smoke-omit-ingest-run-id-${Date.now()}`;

const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const hmacSecret = (process.env.R2_SIGNAL_INGEST_HMAC_SECRET || '').trim();

if (!baseUrl) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL).');
  process.exit(2);
}
if (!serviceRole || !hmacSecret) {
  console.error(
    'Set SUPABASE_SERVICE_ROLE_KEY and R2_SIGNAL_INGEST_HMAC_SECRET (R2 Dashboard → Edge Function secrets + API).',
  );
  process.exit(2);
}

const runId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = new Date().toISOString();
const body = JSON.stringify({
  contract_version: '1.0.0',
  source_system: 'operator_workbench',
  source_repo: 'nickmiller-gif/operator_workbench',
  source_event_type: 'smoke_omit_ingest_run_id',
  actor_meg_entity_id: null,
  related_entity_ids: [],
  event_time: now,
  summary: 'Smoke: omitted ingest_run_id; column should match raw_payload.ingest_run.id',
  raw_payload: {
    ingest_run: {
      id: runId,
      source_system: 'operator_workbench',
      started_at: now,
      trigger: 'smoke_test',
    },
    evidence_tier: 'C',
    sources_queried: ['smoke_source'],
    adversarial_pass: true,
    registry_verified_ratio: 0.5,
  },
  confidence: 0.8,
  privacy_level: 'operator',
  provenance: { smoke: 'r2-signal-ingest-controlled-test', idempotency_hint: idem },
  routing_targets: ['oracle'],
});

const sig = crypto.createHmac('sha256', hmacSecret).update(body).digest('hex');

const res = await fetch(`${baseUrl}/functions/v1/r2-signal-ingest`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${serviceRole}`,
    'Content-Type': 'application/json',
    'x-idempotency-key': idem,
    'x-r2-signature': sig,
  },
  body,
});
const text = await res.text();
process.stdout.write(`HTTP ${res.status}\n${text}\n`);
if (res.status !== 202) process.exit(1);
const j = JSON.parse(text);
process.stdout.write(
  `\nVerify in SQL: ingest_run_id='${runId}', provenance._r2.ingest_run_source='wave1_payload', source_signal_key='operator_workbench:${idem}'\n`,
);
process.stdout.write(`signal_id=${j.signal_id}\n`);
