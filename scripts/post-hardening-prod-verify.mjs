#!/usr/bin/env node
/**
 * Post-hardening production checks (read-only HTTP + optional edge auth).
 *
 * Env (optional):
 *   R2WORKS_BASE_URL — default https://r2works.com
 *   EIGEN_SUPABASE_URL — e.g. https://zudslxucibosjwefojtm.supabase.co
 *   EIGEN_ANON_KEY — publishable key for apikey header
 *   OPERATOR_JWT — member with charter operator role (expect 202 on ingest)
 *   MEMBER_JWT — member without operator role (expect 403 on ingest)
 */
const baseUrl = (process.env.R2WORKS_BASE_URL ?? 'https://r2works.com').replace(/\/$/, '');
const eigenUrl = (process.env.EIGEN_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = process.env.EIGEN_ANON_KEY ?? '';
const operatorJwt = process.env.OPERATOR_JWT ?? '';
const memberJwt = process.env.MEMBER_JWT ?? '';

let failed = 0;

function pass(msg) {
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  console.error(`✖ ${msg}`);
  failed += 1;
}

async function checkR2WorksRoutes() {
  for (const path of ['/friction-zero', '/truth-market', '/today']) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { redirect: 'follow' });
      if (res.ok) pass(`${path} → HTTP ${res.status}`);
      else fail(`${path} → HTTP ${res.status}`);
    } catch (e) {
      fail(`${path} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  try {
    const html = await (await fetch(baseUrl)).text();
    if (/friction-zero|Friction Zero/i.test(html) || /assets\/index-/.test(html)) {
      pass('Home or SPA shell references friction-zero or Vite bundle');
    } else {
      fail('Could not detect friction-zero or index bundle in home HTML (publish may be stale)');
    }
  } catch (e) {
    fail(`Home fetch: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const minimalEnvelope = {
  contract_version: '1.0.0',
  source_system: 'friction_zero',
  source_repo: 'operator-workbench',
  source_event_type: 'prod_verify_probe',
  event_time: new Date().toISOString(),
  summary: 'post-hardening authz probe',
  raw_payload: { probe: true },
  privacy_level: 'operator',
  provenance: { probe: true },
  routing_targets: ['oracle'],
  confidence: 0.5,
};

async function postIngest(jwt, label) {
  const res = await fetch(`${eigenUrl}/functions/v1/r2-signal-ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'x-idempotency-key': `prod-verify:${label}:${Date.now()}`,
    },
    body: JSON.stringify(minimalEnvelope),
  });
  return res.status;
}

async function postPromote(jwt, label) {
  const res = await fetch(`${eigenUrl}/functions/v1/truth-market-promote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'x-idempotency-key': `prod-verify:promote:${label}:${Date.now()}`,
    },
    body: JSON.stringify({
      mode: 'manual',
      title: 'post-hardening promote probe',
      institution_gap_summary: 'probe',
    }),
  });
  return res.status;
}

async function checkEdgeAuthz() {
  if (!eigenUrl || !anonKey) {
    console.log('⊘ Edge authz skipped (set EIGEN_SUPABASE_URL + EIGEN_ANON_KEY)');
    return;
  }
  if (operatorJwt) {
    const ingestStatus = await postIngest(operatorJwt, 'operator');
    if (ingestStatus === 202 || ingestStatus === 200) pass(`operator JWT ingest → ${ingestStatus}`);
    else fail(`operator JWT ingest → ${ingestStatus} (expected 202)`);

    const promoteStatus = await postPromote(operatorJwt, 'operator');
    if (promoteStatus >= 200 && promoteStatus < 300)
      pass(`operator JWT truth-market-promote → ${promoteStatus}`);
    else if (promoteStatus === 422)
      pass(`operator JWT truth-market-promote → 422 (validation; auth ok)`);
    else fail(`operator JWT truth-market-promote → ${promoteStatus} (expected 2xx or 422)`);
  } else {
    console.log('⊘ OPERATOR_JWT not set — skip operator edge checks');
  }
  if (memberJwt) {
    const ingestStatus = await postIngest(memberJwt, 'member');
    if (ingestStatus === 403) pass(`non-operator JWT ingest → 403`);
    else fail(`non-operator JWT ingest → ${ingestStatus} (expected 403)`);

    const promoteStatus = await postPromote(memberJwt, 'member');
    if (promoteStatus === 403) pass(`non-operator JWT truth-market-promote → 403`);
    else fail(`non-operator JWT truth-market-promote → ${promoteStatus} (expected 403)`);
  } else {
    console.log('⊘ MEMBER_JWT not set — skip 403 checks');
  }
}

console.log('=== Post-hardening prod verify ===\n');
console.log(
  'Manual: Lovable publish operator-workbench; SQL dual gate on works.operator_profiles + charter_user_roles.\n',
);
await checkR2WorksRoutes();
console.log('');
await checkEdgeAuthz();
console.log('');
if (failed) {
  console.error(`FAILED (${failed} check(s))`);
  process.exit(1);
}
console.log('All automated checks passed.');
