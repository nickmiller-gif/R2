#!/usr/bin/env node
/**
 * Stage Wave 1 signal ingest hardening loop.
 *
 * Usage:
 *   cd R2
 *   node scripts/stage-wave1-signal-hardening.mjs --iterations 200 --concurrency 8
 *
 * Required env:
 *   R2_SIGNAL_INGEST_URL
 *   R2_SIGNAL_INGEST_BEARER
 *   R2_SIGNAL_INGEST_HMAC_SECRET
 *
 * Optional:
 *   SOURCE_SYSTEM (default: rays_retreat)
 *   SOURCE_REPO (default: nickmiller-gif/r2app)
 *   LOG_EVERY (default: 25)
 */
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import process from 'node:process';

const REQUIRED_ENV = [
  'R2_SIGNAL_INGEST_URL',
  'R2_SIGNAL_INGEST_BEARER',
  'R2_SIGNAL_INGEST_HMAC_SECRET',
];

function parseArgs(argv) {
  const args = {
    iterations: 100,
    concurrency: 4,
    sleepMs: 0,
    failFast: false,
    sourceSystem: process.env.SOURCE_SYSTEM ?? 'rays_retreat',
    sourceRepo: process.env.SOURCE_REPO ?? 'nickmiller-gif/r2app',
    eventPrefix: 'wave1_hardening',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--iterations') args.iterations = Number(argv[++i] ?? args.iterations);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i] ?? args.concurrency);
    else if (arg === '--sleep-ms') args.sleepMs = Number(argv[++i] ?? args.sleepMs);
    else if (arg === '--source-system') args.sourceSystem = String(argv[++i] ?? args.sourceSystem);
    else if (arg === '--source-repo') args.sourceRepo = String(argv[++i] ?? args.sourceRepo);
    else if (arg === '--event-prefix') args.eventPrefix = String(argv[++i] ?? args.eventPrefix);
    else if (arg === '--fail-fast') args.failFast = true;
    else if (arg === '--help') {
      console.log(
        'Usage: node scripts/stage-wave1-signal-hardening.mjs [--iterations N] [--concurrency N] [--sleep-ms N] [--source-system value] [--source-repo value] [--event-prefix value] [--fail-fast]',
      );
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.iterations) || args.iterations < 1)
    throw new Error('iterations must be >= 1');
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1)
    throw new Error('concurrency must be >= 1');
  if (!Number.isFinite(args.sleepMs) || args.sleepMs < 0) throw new Error('sleep-ms must be >= 0');
  return args;
}

function loadDotenv(filepath) {
  if (!existsSync(filepath)) return;
  const text = readFileSync(filepath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function ensureEnv() {
  // Convenience: permit local env file usage without exporting variables.
  loadDotenv('.env.wave1.local');
  loadDotenv('.env.supabase.local');
  loadDotenv('.env');

  // Backward-compat mapping for older variable names.
  if (!process.env.R2_SIGNAL_INGEST_URL) {
    process.env.R2_SIGNAL_INGEST_URL =
      process.env.R2_EIGEN_INGEST_URL ?? process.env.R2_EIGEN_INGEST_ENDPOINT;
  }
  if (!process.env.R2_SIGNAL_INGEST_BEARER) {
    process.env.R2_SIGNAL_INGEST_BEARER = process.env.R2_EIGEN_INGEST_BEARER;
  }
  if (!process.env.R2_SIGNAL_INGEST_HMAC_SECRET) {
    process.env.R2_SIGNAL_INGEST_HMAC_SECRET = process.env.R2_EIGEN_INGEST_HMAC_SECRET;
  }

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function signBody(secret, body) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function baseEnvelope({ sourceSystem, sourceRepo, eventPrefix, iteration, idempotencyKey }) {
  const now = new Date().toISOString();
  return {
    contract_version: '1.0.0',
    source_system: sourceSystem,
    source_repo: sourceRepo,
    source_event_type: `${eventPrefix}_valid`,
    actor_meg_entity_id: null,
    related_entity_ids: [],
    event_time: now,
    summary: `Wave1 hardening probe ${iteration}`,
    raw_payload: {
      ingest_run: {
        id: randomUUID(),
        source_system: sourceSystem,
        started_at: now,
        trigger: 'stage_wave1_signal_hardening',
      },
      evidence_tier: 'C',
      sources_queried: ['hardening_script'],
      adversarial_pass: true,
      registry_verified_ratio: 0.6,
      probe_idempotency_key: idempotencyKey,
    },
    confidence: 0.77,
    privacy_level: 'operator',
    provenance: { table: 'hardening_probe', row_id: idempotencyKey },
    routing_targets: ['oracle', 'meg'],
    ingest_run_id: randomUUID(),
  };
}

function mutateEnvelope(mode, envelope) {
  const copy = JSON.parse(JSON.stringify(envelope));
  switch (mode) {
    case 'valid':
      return copy;
    case 'missing_ingest_run':
      delete copy.raw_payload.ingest_run;
      copy.source_event_type = 'wave1_missing_ingest_run';
      return copy;
    case 'source_mismatch':
      copy.raw_payload.ingest_run.source_system = 'mismatch_source';
      copy.source_event_type = 'wave1_source_mismatch';
      return copy;
    case 'invalid_ratio':
      copy.raw_payload.registry_verified_ratio = 1.5;
      copy.source_event_type = 'wave1_invalid_ratio';
      return copy;
    case 'empty_sources':
      copy.raw_payload.sources_queried = [];
      copy.source_event_type = 'wave1_empty_sources';
      return copy;
    case 'invalid_tier':
      copy.raw_payload.evidence_tier = 'Z';
      copy.source_event_type = 'wave1_invalid_tier';
      return copy;
    case 'duplicate_idempotency':
      copy.source_event_type = 'wave1_duplicate_replay';
      return copy;
    default:
      throw new Error(`unknown mode ${mode}`);
  }
}

function expectedStatus(mode) {
  if (mode === 'valid' || mode === 'duplicate_idempotency') return 202;
  return 422;
}

async function postSignal({ url, bearer, secret, idempotencyKey, mode, envelope }) {
  const body = JSON.stringify(envelope);
  let signature = signBody(secret, body);
  if (mode === 'tampered_signature') signature = `${signature}dead`;
  const headers = {
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
    'x-idempotency-key': idempotencyKey,
  };
  if (mode !== 'missing_signature') headers['x-r2-signature'] = signature;
  const res = await fetch(url, { method: 'POST', headers, body });
  const text = await res.text().catch(() => '');
  return { status: res.status, text };
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv);
  ensureEnv();

  const url = process.env.R2_SIGNAL_INGEST_URL;
  const bearer = process.env.R2_SIGNAL_INGEST_BEARER;
  const secret = process.env.R2_SIGNAL_INGEST_HMAC_SECRET;
  const logEvery = Number(process.env.LOG_EVERY ?? 25);
  const modes = [
    'valid',
    'missing_ingest_run',
    'source_mismatch',
    'invalid_ratio',
    'empty_sources',
    'invalid_tier',
    'tampered_signature',
    'missing_signature',
    'duplicate_idempotency',
  ];

  const stats = {
    total: 0,
    pass: 0,
    fail: 0,
    byMode: Object.fromEntries(modes.map((m) => [m, { pass: 0, fail: 0 }])),
  };

  let stop = false;
  let next = 0;
  let duplicateSeed = randomUUID();

  async function worker(workerIdx) {
    while (!stop) {
      const iteration = next++;
      if (iteration >= args.iterations) return;
      const mode = modes[iteration % modes.length];
      const duplicateKey = mode === 'duplicate_idempotency' ? `dup-${duplicateSeed}` : randomUUID();
      if (mode === 'duplicate_idempotency' && iteration % (modes.length * 3) === 0) {
        duplicateSeed = randomUUID();
      }
      const envelope = mutateEnvelope(
        mode === 'tampered_signature' || mode === 'missing_signature' ? 'valid' : mode,
        baseEnvelope({
          sourceSystem: args.sourceSystem,
          sourceRepo: args.sourceRepo,
          eventPrefix: args.eventPrefix,
          iteration,
          idempotencyKey: duplicateKey,
        }),
      );
      const expected =
        mode === 'tampered_signature' || mode === 'missing_signature' ? 401 : expectedStatus(mode);
      const { status, text } = await postSignal({
        url,
        bearer,
        secret,
        idempotencyKey: duplicateKey,
        mode,
        envelope,
      });

      stats.total += 1;
      if (status === expected) {
        stats.pass += 1;
        stats.byMode[mode].pass += 1;
      } else {
        stats.fail += 1;
        stats.byMode[mode].fail += 1;
        console.error(
          `[FAIL][worker:${workerIdx}][iter:${iteration}][mode:${mode}] expected=${expected} actual=${status} body=${text.slice(0, 300)}`,
        );
        if (args.failFast) {
          stop = true;
          return;
        }
      }

      if (stats.total % logEvery === 0 || stats.total === args.iterations) {
        console.log(
          `[PROGRESS] total=${stats.total}/${args.iterations} pass=${stats.pass} fail=${stats.fail}`,
        );
      }
      await sleep(args.sleepMs);
    }
  }

  const workers = Array.from({ length: args.concurrency }, (_, idx) => worker(idx + 1));
  await Promise.all(workers);

  console.log('\n=== Wave 1 hardening summary ===');
  console.log(JSON.stringify(stats, null, 2));
  if (stats.fail > 0) process.exit(2);
}

main().catch((err) => {
  console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
