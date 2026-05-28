#!/usr/bin/env node
/**
 * Audit + smoke autonomous bot stack on Eigen.
 *   node scripts/verify-autonomous-bots.mjs
 *   node scripts/verify-autonomous-bots.mjs --skip-remote   # unit tests only
 *
 * Loads R2/.env.wave1.local when present (gitignored).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wave1 = join(root, '.env.wave1.local');
if (existsSync(wave1)) {
  for (const line of readFileSync(wave1, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i);
    if (!process.env[k]) process.env[k] = t.slice(i + 1);
  }
}

const skipRemote = process.argv.includes('--skip-remote');
const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
}

function runNode(script, args = []) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: 180_000,
  });
  return r;
}

// --- config.toml presence ---
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
for (const fn of [
  'autonomous-upgrade-scout',
  'autonomous-news-rss-cron',
  'autonomous-revolutionary-mesh',
  'autonomous-information-audit',
  'autonomous-information-audit-cron',
  'autonomous-steward-cycle',
  'autonomous-steward-cycle-cron',
  'meg-kb-four-backfill-links',
]) {
  if (config.includes(`[functions.${fn}]`)) pass(`config-${fn}`, 'listed');
  else fail(`config-${fn}`, 'missing from config.toml');
}

// --- vitest ---
const vitest = spawnSync(
  'npm',
  [
    'run',
    'test',
    '--',
    ...[
      'tests/steward-cycle-cluster.test.ts',
      'tests/steward-audit-scope.test.ts',
      'tests/r2-eval/steward-brief-scorer.test.ts',
      'tests/r2-eval/revolutionary-mesh-scorer.test.ts',
      'tests/r2-eval/op5-pass-rate-gate.test.ts',
    ],
  ],
  { cwd: root, encoding: 'utf8', shell: true },
);
if (vitest.status === 0) pass('vitest-bots', '11 tests');
else fail('vitest-bots', vitest.stderr?.slice(0, 200) || 'failed');

if (skipRemote) {
  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

const srk = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!srk) {
  fail('env-service-role', 'SUPABASE_SERVICE_ROLE_KEY missing — source .env.wave1.local');
} else {
  pass('env-service-role', 'set');
  process.env.STEWARD_CYCLE_SERVICE_TOKEN ||= srk;
  process.env.AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN ||= srk;
  process.env.INFORMATION_AUDIT_SERVICE_TOKEN ||= srk;
  process.env.REVOLUTIONARY_MESH_SERVICE_TOKEN ||= srk;
}

const smokes = [
  ['smoke-steward', 'run-autonomous-steward-cycle.mjs', []],
  ['smoke-audit', 'run-autonomous-information-audit.mjs', []],
  ['smoke-mesh', 'run-autonomous-revolutionary-mesh.mjs', []],
  ['smoke-scout-centralr2', 'run-autonomous-scout-drivers.mjs', ['--driver', 'centralr2']],
];

for (const [id, script, args] of smokes) {
  if (!srk) {
    fail(id, 'skipped (no service role)');
    continue;
  }
  const r = runNode(script, args);
  const ok = r.status === 0;
  let detail = `exit ${r.status}`;
  try {
    const line = (r.stdout || '').trim().split('\n').pop();
    if (line) {
      const parsed = JSON.parse(line);
      detail = `HTTP ${parsed.status ?? '?'}`;
    }
  } catch {
    /* ignore */
  }
  if (ok) pass(id, detail);
  else fail(id, `${detail} — redeploy Edge functions if audit 500 on knowledge_chunks`);
}

function printSummary() {
  console.log('\n=== Autonomous bots verification ===\n');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}: ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
}

printSummary();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
