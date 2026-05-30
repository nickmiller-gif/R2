#!/usr/bin/env node
/**
 * Cross-repo bridge: assemble REGENT's world-state from the LIVE repo
 * constellation (via the reference engine's discover_context.py) and post it to
 * the autonomous-regent-review bot, which reviews it and emits one advisory
 * signal into platform_feed_items.
 *
 * This is how the executive team's "review all assets across the repos" reaches
 * production: the local scan produces observed repo facts (commit age, env-file
 * exposure, tests/CI/handoff presence); financials stay UNSOURCED by design.
 *
 *   node scripts/regent-publish-world-state.mjs
 *   node scripts/regent-publish-world-state.mjs --regent-dir /Users/nick/CMU/regent --root "/Users/nick/Desktop/R2 Complete"
 */

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireBotServiceToken } from './lib/resolve-bot-service-token.mjs';

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const regentDir = arg('--regent-dir', process.env.REGENT_DIR ?? '/Users/nick/CMU/regent');
const root = arg('--root', process.env.R2_CONSTELLATION_ROOT ?? '/Users/nick/Desktop/R2 Complete');
const discover = join(regentDir, 'discover_context.py');

if (!existsSync(discover)) {
  console.error(`discover_context.py not found at ${discover}. Pass --regent-dir.`);
  process.exit(1);
}

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const { token, source: tokenSource } = requireBotServiceToken(
  'REGENT_REVIEW_SERVICE_TOKEN',
  'INFORMATION_AUDIT_SERVICE_TOKEN',
  'AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN',
);

const outFile = join(tmpdir(), `regent-world-state-${randomUUID()}.json`);
const py = spawnSync('python3', [discover, '--root', root, '--out', outFile], {
  encoding: 'utf8',
  cwd: regentDir,
});
if (py.status !== 0) {
  console.error('discover_context.py failed:', py.stderr || py.stdout);
  process.exit(1);
}

const worldState = JSON.parse(readFileSync(outFile, 'utf8'));
rmSync(outFile, { force: true });

const repoCount = Array.isArray(worldState.repo_assets) ? worldState.repo_assets.length : 0;
const idempotencyKey =
  process.env.REGENT_IDEM_KEY?.trim() ??
  `regent-publish:${worldState.as_of ?? new Date().toISOString().slice(0, 10)}:${randomUUID()}`;

const res = await fetch(`${EIGEN_URL}/functions/v1/autonomous-regent-review`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-idempotency-key': idempotencyKey,
  },
  body: JSON.stringify({ world_state: worldState }),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log(
  JSON.stringify(
    { status: res.status, repos_reviewed: repoCount, idempotencyKey, tokenSource, body },
    null,
    2,
  ),
);
process.exit(res.ok ? 0 : 1);
