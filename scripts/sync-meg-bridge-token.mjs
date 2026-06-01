#!/usr/bin/env node
/**
 * Rotate/sync MEG_RESOLVE_BRIDGE_TOKEN on Eigen (Management API).
 * Tower (ukffrvqainkntdgjzyde) often returns 403 — set the same value in Lovable.
 *
 * Writes token to R2/.env.meg-bridge.local (gitignored) for local verify scripts.
 *
 * ENV: SUPABASE_ACCESS_TOKEN (sbp_…)
 * Usage: node scripts/sync-meg-bridge-token.mjs [--dry-run]
 */
import { randomBytes, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EIGEN_REF = 'zudslxucibosjwefojtm';
const TOWER_REF = 'ukffrvqainkntdgjzyde';
const DRY = process.argv.includes('--dry-run');
const token = process.env.MEG_RESOLVE_BRIDGE_TOKEN?.trim() || randomBytes(32).toString('hex');
const pat = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!pat?.startsWith('sbp_')) {
  console.error('SUPABASE_ACCESS_TOKEN (sbp_…) required.');
  process.exit(2);
}

async function postSecret(projectRef) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ name: 'MEG_RESOLVE_BRIDGE_TOKEN', value: token }]),
  });
  const text = await res.text();
  return { ref: projectRef, status: res.status, ok: res.ok, text: text.slice(0, 200) };
}

async function main() {
  const fp = createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 16);
  console.log(`MEG_RESOLVE_BRIDGE_TOKEN fingerprint (sha256 prefix): ${fp}`);
  if (DRY) {
    console.log('dry-run — no API writes');
    process.exit(0);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const localPath = join(here, '..', '.env.meg-bridge.local');
  writeFileSync(localPath, `MEG_RESOLVE_BRIDGE_TOKEN=${token}\n`, { mode: 0o600 });
  console.log(`Wrote ${localPath} (gitignored)`);

  for (const ref of [EIGEN_REF, TOWER_REF]) {
    const r = await postSecret(ref);
    console.log(`${ref}: HTTP ${r.status}${r.ok ? ' OK' : ''}`);
    if (!r.ok && r.text) console.log(r.text);
  }

  console.log(
    '\nTower 403 is expected — paste the same token in Lovable secrets for ukffrvqainkntdgjzyde, then redeploy sync edges.',
  );
  console.log('Store in 1Password: op item edit meg-resolve-bridge --vault R2 password=<token>');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
