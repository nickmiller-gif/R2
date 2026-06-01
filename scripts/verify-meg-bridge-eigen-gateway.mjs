#!/usr/bin/env node
/**
 * Detect Eigen meg-resolve-bridge verify_jwt drift (opaque bearer blocked at gateway).
 *
 * Requires: R2_SUPABASE_ANON_KEY or EIGEN_SUPABASE_ANON_KEY, MEG_RESOLVE_BRIDGE_TOKEN (opaque)
 * Optional: MEG_RESOLVE_BRIDGE_URL, SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF for Management API check
 *
 * Run: op run --env-file=op.env -- node scripts/verify-meg-bridge-eigen-gateway.mjs
 */
const EIGEN_REF = 'zudslxucibosjwefojtm';
const DEFAULT_BRIDGE_URL = `https://${EIGEN_REF}.supabase.co/functions/v1/meg-resolve-bridge`;

function normalizeToken(raw) {
  const trimmed = (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '');
  const m = trimmed.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] ?? trimmed).trim();
}

async function managementVerifyJwt() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const ref = process.env.SUPABASE_PROJECT_REF?.trim() ?? EIGEN_REF;
  if (!token?.startsWith('sbp_')) return { skipped: true, verify_jwt: null };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/functions/meg-resolve-bridge`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    return { skipped: true, verify_jwt: null, error: `Management API ${res.status}` };
  }
  const json = await res.json();
  return { skipped: false, verify_jwt: json.verify_jwt ?? null };
}

async function liveProbe() {
  const bridgeUrl = (process.env.MEG_RESOLVE_BRIDGE_URL ?? DEFAULT_BRIDGE_URL).trim();
  const bridgeToken = normalizeToken(process.env.MEG_RESOLVE_BRIDGE_TOKEN);
  const anon = (
    process.env.R2_SUPABASE_ANON_KEY ??
    process.env.EIGEN_SUPABASE_ANON_KEY ??
    ''
  ).trim();

  if (!bridgeToken || bridgeToken.length < 32) {
    console.error('FAIL: MEG_RESOLVE_BRIDGE_TOKEN missing or shorter than 32 chars');
    process.exit(1);
  }
  if (bridgeToken.split('.').length === 3 && /^eyJ/i.test(bridgeToken)) {
    console.error('FAIL: MEG_RESOLVE_BRIDGE_TOKEN looks like a JWT — use opaque hex secret');
    process.exit(1);
  }
  if (!anon) {
    console.error(
      'FAIL: R2_SUPABASE_ANON_KEY or EIGEN_SUPABASE_ANON_KEY required for gateway probe',
    );
    process.exit(1);
  }

  const res = await fetch(bridgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bridgeToken}`,
      apikey: anon,
    },
    body: JSON.stringify({
      source_platform: 'centralr2',
      external_id: '00000000-0000-4000-8000-000000000099',
      kind: 'property',
      hints: {
        display_name: 'gateway-verify-probe',
        address: '1 Main',
        city: 'Austin',
        state: 'TX',
      },
    }),
  });
  const text = await res.text().catch(() => '');
  const jwtBlock = /INVALID_JWT|Invalid JWT/i.test(text);

  return { status: res.status, text: text.slice(0, 300), jwtBlock };
}

async function main() {
  const mgmt = await managementVerifyJwt();
  const probe = await liveProbe();

  if (mgmt.verify_jwt === true) {
    console.error('FAIL: Management API reports meg-resolve-bridge verify_jwt=true');
    process.exit(1);
  }
  if (mgmt.verify_jwt === false) {
    console.log('OK: Management API verify_jwt=false');
  } else if (mgmt.skipped) {
    console.log('SKIP: Management API check', mgmt.error ?? '(no sbp_ token)');
  }

  if (probe.jwtBlock) {
    console.error('FAIL: Live probe got Invalid JWT at gateway — PATCH verify_jwt=false');
    console.error('body:', probe.text);
    process.exit(1);
  }

  if (probe.status === 200) {
    console.log('OK: Live probe HTTP 200 — opaque bearer accepted and authenticated');
    process.exit(0);
  }
  if (probe.status === 401) {
    console.log('WARN: Gateway accepts opaque bearer but token mismatch (HTTP 401)');
    console.log('Align Tower MEG_RESOLVE_BRIDGE_TOKEN with Eigen meg-resolve-bridge secret');
    process.exit(0);
  }

  console.error(`FAIL: Unexpected probe HTTP ${probe.status}:`, probe.text);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
