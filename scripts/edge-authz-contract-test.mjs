#!/usr/bin/env node
/**
 * CI contract: member JWT without operator role → 403 on signal edges.
 * Gated on EIGEN_SUPABASE_URL, EIGEN_ANON_KEY, MEMBER_JWT (no operator role).
 */
const eigenUrl = (process.env.EIGEN_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = process.env.EIGEN_ANON_KEY ?? '';
const memberJwt = process.env.MEMBER_JWT ?? '';
const operatorJwt = process.env.OPERATOR_JWT ?? '';

if (!eigenUrl || !anonKey) {
  console.log('[edge-authz-contract] Skipping — EIGEN_SUPABASE_URL / EIGEN_ANON_KEY not set');
  process.exit(0);
}

const envelope = {
  contract_version: '1.0.0',
  source_system: 'friction_zero',
  source_repo: 'r2-contract-test',
  source_event_type: 'authz_contract_probe',
  event_time: new Date().toISOString(),
  summary: 'authz contract probe',
  raw_payload: { contract_test: true },
  privacy_level: 'operator',
  provenance: { contract_test: true },
  routing_targets: ['oracle'],
  confidence: 0.5,
};

async function post(path, jwt) {
  const res = await fetch(`${eigenUrl}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'x-idempotency-key': `contract:${path}:${Date.now()}`,
    },
    body: JSON.stringify(
      path === 'truth-market-promote'
        ? { mode: 'manual', title: 'Contract probe', institution_gap_summary: 'probe' }
        : envelope,
    ),
  });
  return res.status;
}

let failed = 0;

if (memberJwt) {
  for (const fn of ['r2-signal-ingest', 'truth-market-promote']) {
    const status = await post(fn, memberJwt);
    if (status === 403) {
      console.log(`✓ ${fn} + member JWT → 403`);
    } else {
      console.error(`✖ ${fn} + member JWT → ${status} (expected 403)`);
      failed += 1;
    }
  }
} else {
  console.log('[edge-authz-contract] MEMBER_JWT not set — skip 403 checks');
}

if (operatorJwt) {
  const status = await post('r2-signal-ingest', operatorJwt);
  if (status === 202 || status === 200) {
    console.log(`✓ r2-signal-ingest + operator JWT → ${status}`);
  } else {
    console.error(`✖ r2-signal-ingest + operator JWT → ${status} (expected 202)`);
    failed += 1;
  }
}

process.exit(failed ? 1 : 0);
