#!/usr/bin/env node
/**
 * Trigger autonomous-news-rss-cron for one or all KB-four drivers.
 *
 * Usage:
 *   node scripts/run-autonomous-scout-drivers.mjs
 *   node scripts/run-autonomous-scout-drivers.mjs --driver centralr2
 *   node scripts/run-autonomous-scout-drivers.mjs --all
 *
 * Requires EIGEN_SUPABASE_URL (or SUPABASE_URL) in env.
 */

import { resolveBotServiceToken } from './lib/resolve-bot-service-token.mjs';

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const DRIVERS = ['centralr2', 'operator_workbench', 'r2chart', 'ip_pulse_point'];

function parseArgs(argv) {
  let driver = null;
  let all = false;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--driver' && argv[i + 1]) {
      driver = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--all') {
      all = true;
    }
  }
  if (all) return DRIVERS;
  if (driver) return [driver];
  return DRIVERS;
}

async function triggerDriver(driver) {
  const url = new URL(`${EIGEN_URL}/functions/v1/autonomous-news-rss-cron`);
  url.searchParams.set('driver', driver);
  const headers = { 'content-type': 'application/json' };
  const resolved = resolveBotServiceToken(
    'AUTONOMOUS_NEWS_CRON_TOKEN',
    'AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN',
  );
  if (resolved) headers.authorization = `Bearer ${resolved.token}`;

  const res = await fetch(url.toString(), { method: 'POST', headers });
  const body = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  return { driver, status: res.status, body: parsed };
}

async function main() {
  const targets = parseArgs(process.argv);
  for (const id of targets) {
    if (!DRIVERS.includes(id)) {
      console.error(`Unknown driver ${id}. Use: ${DRIVERS.join(', ')}`);
      process.exit(1);
    }
  }

  const results = [];
  for (const driver of targets) {
    const result = await triggerDriver(driver);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }

  const failed = results.filter((r) => r.status < 200 || r.status >= 300);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
