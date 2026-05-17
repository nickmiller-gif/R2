#!/usr/bin/env node
/**
 * Phase 1 security scan — R2 / Eigen `public` schema + edge hardening.
 *
 * Mirrors operator-workbench/scripts/security-scan.mjs but targets `public`
 * (Friction Zero, Truth Market, platform_feed_items, charter RBAC).
 *
 * verify_jwt=false functions must call guardAuth, verifySignalHmac,
 * tryServiceRoleAuth, and/or requireRole — not only verifyHmacRequest.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GATING_LINTS = new Set([
  '0008_rls_enabled_no_policy',
  '0009_policy_exists_rls_disabled',
  '0010_rls_disabled_in_public',
  '0011_function_search_path_mutable',
  '0013_rls_references_user_metadata',
  '0015_security_definer_view',
  '0017_security_definer_view',
  '0018_unsupported_reg_types',
  '0019_insecure_queue_exposed_in_api',
  '0020_table_bloat',
  '0021_fkey_to_auth_unique',
  '0022_unindexed_foreign_keys',
  '0027_auth_users_exposed',
  '0028_anon_security_definer_function_executable',
  '0030_extension_in_public',
]);

const GLOBAL_BLOCKING_LINTS = new Set([
  '0027_auth_users_exposed',
  '0028_anon_security_definer_function_executable',
  '0019_insecure_queue_exposed_in_api',
]);

const TARGET_SCHEMA = 'public';

const FUNCTIONS_DIR = 'supabase/functions';
const CONFIG_TOML = 'supabase/config.toml';
const MIGRATIONS_DIR = 'supabase/migrations';

/** Functions that must enforce auth in-handler when verify_jwt=false. */
const AUTH_REQUIRED_FUNCTIONS = new Set([
  'r2-signal-ingest',
  'truth-market-promote',
  'continuity-ingest-signal',
  'eigen-fetch-ingest',
]);

const HMAC_EXEMPT_FUNCTIONS = new Set([]);

const AUTH_PATTERNS =
  /guardAuth\s*\(|verifySignalHmac\s*\(|verifyHmacRequest\s*\(|tryServiceRoleAuth\s*\(|requireRole\s*\(/;

function parseFunctionVerifyJwt() {
  if (!existsSync(CONFIG_TOML)) return new Map();
  const text = readFileSync(CONFIG_TOML, 'utf8');
  const map = new Map();
  const re = /\[functions\.([a-z0-9-_]+)\]\s*\n\s*verify_jwt\s*=\s*(true|false)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    map.set(m[1], m[2] === 'true');
  }
  return map;
}

function listFunctions() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR).filter((name) => {
    if (name.startsWith('_')) return false;
    const p = join(FUNCTIONS_DIR, name);
    return statSync(p).isDirectory() && existsSync(join(p, 'index.ts'));
  });
}

function lintEdgeFunctions() {
  const findings = [];
  const verifyJwt = parseFunctionVerifyJwt();
  for (const fn of listFunctions()) {
    const indexPath = join(FUNCTIONS_DIR, fn, 'index.ts');
    const src = readFileSync(indexPath, 'utf8');
    const jwtVerified = verifyJwt.get(fn) !== false;

    if (!jwtVerified && AUTH_REQUIRED_FUNCTIONS.has(fn) && !HMAC_EXEMPT_FUNCTIONS.has(fn)) {
      if (!AUTH_PATTERNS.test(src)) {
        findings.push({
          fn,
          rule: 'edge_unauth_requires_auth',
          detail:
            'verify_jwt=false but no guardAuth / verifySignalHmac / tryServiceRoleAuth / requireRole — endpoint may be fully unauthenticated.',
        });
      }
    }

    const callRe = /createClient\s*\(/g;
    let cm;
    while ((cm = callRe.exec(src)) !== null) {
      let depth = 1;
      let i = cm.index + cm[0].length;
      while (i < src.length && depth > 0) {
        const ch = src[i++];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      const call = src.slice(cm.index, i);
      if (/SUPABASE_SERVICE_ROLE_KEY/.test(call) && /Authorization/i.test(call)) {
        findings.push({
          fn,
          rule: 'edge_service_role_caller_token_mix',
          detail:
            'createClient() combines SERVICE_ROLE_KEY with a forwarded caller Authorization header.',
        });
        break;
      }
    }

    if (!jwtVerified && /console\.log\([^)]*rawBody/.test(src)) {
      findings.push({
        fn,
        rule: 'edge_unauth_logs_raw_body',
        detail: 'Unauthenticated function logs rawBody.',
      });
    }
  }
  return findings;
}

function lintMigrationsForSearchPath() {
  const findings = [];
  if (!existsSync(MIGRATIONS_DIR)) return findings;
  const GATED_PREFIXES = ['20260516', '20260517'];
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    if (!file.endsWith('.sql') || /\s2\.sql$/i.test(file)) continue;
    if (!GATED_PREFIXES.some((p) => file.startsWith(p))) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const blocks = sql.split(/(?=create\s+(?:or\s+replace\s+)?function)/gi);
    for (const block of blocks) {
      if (!/security\s+definer/i.test(block)) continue;
      if (!/set\s+search_path\s*=/i.test(block)) {
        const nameMatch = block.match(/create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_."]+)/i);
        const target = nameMatch?.[1] ?? '(unknown)';
        if (target.startsWith('public.') || /\.public\./i.test(block) || !target.includes('.')) {
          findings.push({
            file,
            fn: target,
            rule: 'definer_function_mutable_search_path',
            detail: `SECURITY DEFINER ${target} in ${file} is missing SET search_path`,
          });
        }
      }
    }
  }
  return findings;
}

function hasSupabaseCli() {
  const res = spawnSync('supabase', ['--version'], { encoding: 'utf8' });
  return !res.error && res.status === 0;
}

function tryLinkProject() {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!projectRef || !process.env.SUPABASE_ACCESS_TOKEN) return false;
  const res = spawnSync('supabase', ['link', '--project-ref', projectRef], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || '').trim();
    console.log(
      `[security-scan] unable to link project ${projectRef} — skipping DB lint${msg ? ` (${msg})` : ''}.`,
    );
    return false;
  }
  return true;
}

function runLint() {
  if (!tryLinkProject()) return [];

  const res = spawnSync(
    'supabase',
    ['db', 'lint', '--linked', '--level', 'warning', '--output', 'json'],
    { encoding: 'utf8' },
  );
  if (res.error) {
    console.error(`[security-scan] failed to invoke supabase CLI: ${res.error.message}`);
    process.exit(2);
  }
  if (!res.stdout.trim()) {
    const msg = (res.stderr || '').trim();
    console.log(
      `[security-scan] empty output from supabase db lint — skipping DB lint${msg ? ` (${msg})` : ''}.`,
    );
    return [];
  }
  return JSON.parse(res.stdout);
}

function lintKey(finding) {
  const name = finding.name ?? finding.title ?? '';
  for (const key of GATING_LINTS) {
    if (key.endsWith(name)) return key;
  }
  return null;
}

function findingSchema(finding) {
  return finding.metadata?.schema ?? finding.detail?.match(/schema "?([\w.]+)"?/i)?.[1] ?? null;
}

const blocking = [];
const advisory = [];

for (const f of lintEdgeFunctions()) {
  blocking.push({ key: f.rule, schema: `edge:${f.fn}`, detail: f.detail });
}
for (const f of lintMigrationsForSearchPath()) {
  blocking.push({ key: f.rule, schema: TARGET_SCHEMA, detail: f.detail });
}

if (process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF && hasSupabaseCli()) {
  const findings = runLint();
  for (const f of findings) {
    const key = lintKey(f);
    if (!key) continue;
    const schema = findingSchema(f);
    const target = { key, schema, name: f.name, detail: f.detail ?? f.description };
    if (schema === TARGET_SCHEMA || GLOBAL_BLOCKING_LINTS.has(key)) blocking.push(target);
    else advisory.push(target);
  }
} else {
  const reason = !process.env.SUPABASE_ACCESS_TOKEN
    ? 'SUPABASE_ACCESS_TOKEN not set'
    : 'supabase CLI not in PATH';
  console.log(`[security-scan] ${reason} — skipping DB lint (edge + migration gates still run).`);
}

if (advisory.length) {
  console.log(`[security-scan] advisory (${advisory.length}):`);
  for (const a of advisory) console.log(`  - ${a.key} ${a.schema ?? '?'} :: ${a.detail}`);
}

if (blocking.length) {
  console.error(`[security-scan] BLOCKING (${blocking.length}):`);
  for (const b of blocking) console.error(`  ✖ [${b.schema ?? '?'}] ${b.key} :: ${b.detail}`);
  process.exit(1);
}

console.log(`[security-scan] OK — edge, migrations, and ${TARGET_SCHEMA}.* clean.`);
