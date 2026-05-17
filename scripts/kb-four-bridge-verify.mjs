#!/usr/bin/env node
/**
 * Read-only KB-four bridge verification (Eigen PostgREST).
 * Requires SUPABASE_URL (Eigen) + SUPABASE_SERVICE_ROLE_KEY in env (never log values).
 *
 * Checks recent platform_feed_items for r2chart and ip_pulse_point.
 */
const url = (process.env.SUPABASE_URL ?? process.env.EIGEN_SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !key) {
  console.log(
    '[kb-four-verify] Skipping — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (gitignored env only)',
  );
  process.exit(0);
}

const systems = ['r2chart', 'ip_pulse_point', 'centralr2', 'operator_workbench', 'friction_zero'];

async function count(system) {
  const q = new URL(`${url}/rest/v1/platform_feed_items`);
  q.searchParams.set('select', 'id');
  q.searchParams.set('source_system', `eq.${system}`);
  q.searchParams.set('order', 'created_at.desc');
  q.searchParams.set('limit', '1');
  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    return { system, error: `${res.status}` };
  }
  const rows = await res.json();
  return { system, hasRow: Array.isArray(rows) && rows.length > 0, id: rows[0]?.id };
}

console.log('=== KB-four feed smoke (read-only) ===\n');
console.log('Secrets parity: see R2/scripts/kb-four-bridge-smoke.md\n');

let missing = 0;
for (const system of systems) {
  const r = await count(system);
  if (r.error) {
    console.log(`? ${system}: query failed (${r.error})`);
  } else if (r.hasRow) {
    console.log(`✓ ${system}: recent row (${String(r.id).slice(0, 8)}…)`);
  } else {
    console.log(`✖ ${system}: no rows in platform_feed_items`);
    if (system === 'r2chart' || system === 'ip_pulse_point') missing += 1;
  }
}

if (missing) {
  console.error(
    '\nBridge wiring incomplete for KB-four drivers — set secrets and redeploy continuity-ingest-signal / ip-router.',
  );
  process.exit(1);
}
console.log('\nKB-four drivers have feed traffic.');
