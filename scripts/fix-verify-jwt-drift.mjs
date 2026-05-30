#!/usr/bin/env node
/**
 * fix-verify-jwt-drift.mjs
 *
 * Re-pins edge-function `verify_jwt` to match supabase/config.toml.
 *
 * WHY: deploys (Supabase GitHub integration / Lovable republish / MCP
 * deploy_edge_function, which defaults verify_jwt=true) repeatedly override the
 * repo's `[functions.X] verify_jwt = false` settings. When that happens, every
 * cron / custom-token / HMAC / public caller is rejected at the gateway with 401
 * BEFORE the function body runs (jobs/edges "fail at startup"), silently breaking
 * the autonomous loop, KB-four ingest, Oracle pipeline, etc.
 *
 * This script reads config.toml, finds functions whose deployed verify_jwt
 * drifted away from the configured value, and PATCHes them back via the Supabase
 * Management API. It is idempotent and safe to run after every deploy (e.g. as a
 * post-deploy CI step).
 *
 * ENV (required):
 *   SUPABASE_ACCESS_TOKEN   account/management token (sbp_...)
 *   SUPABASE_PROJECT_REF    e.g. zudslxucibosjwefojtm
 *
 * Usage:  node scripts/fix-verify-jwt-drift.mjs [--dry-run]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const DRY = process.argv.includes('--dry-run');
if (!TOKEN || !REF) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
  process.exit(2);
}
const API = `https://api.supabase.com/v1/projects/${REF}/functions`;
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function parseConfig() {
  const here = dirname(fileURLToPath(import.meta.url));
  const toml = readFileSync(join(here, '..', 'supabase', 'config.toml'), 'utf8');
  const want = new Map();
  let cur = null;
  for (const line of toml.split('\n')) {
    const m = line.match(/^\s*\[functions\.([^\]]+)\]/);
    if (m) {
      cur = m[1];
      continue;
    }
    const v = line.match(/^\s*verify_jwt\s*=\s*(true|false)/);
    if (v && cur) {
      want.set(cur, v[1] === 'true');
      cur = null;
    }
  }
  return want;
}

async function main() {
  const want = parseConfig();
  const listed = await (await fetch(API, { headers: H })).json();
  const deployed = new Map(
    (Array.isArray(listed) ? listed : []).map((f) => [f.name, f.verify_jwt]),
  );
  let fixed = 0,
    checked = 0,
    missing = 0;
  for (const [slug, wantVal] of want) {
    if (!deployed.has(slug)) {
      missing++;
      continue;
    }
    checked++;
    if (deployed.get(slug) === wantVal) continue;
    console.log(
      `${DRY ? '[dry] ' : ''}drift: ${slug} deployed=${deployed.get(slug)} want=${wantVal}`,
    );
    if (!DRY) {
      const r = await fetch(`${API}/${slug}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({ verify_jwt: wantVal }),
      });
      if (!r.ok) {
        console.error(`  PATCH ${slug} failed: ${r.status}`);
        continue;
      }
    }
    fixed++;
  }
  console.log(`checked=${checked} drifted${DRY ? '' : '_fixed'}=${fixed} not_deployed=${missing}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
