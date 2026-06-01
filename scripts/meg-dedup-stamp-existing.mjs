#!/usr/bin/env node
/**
 * Stamp meg_dedup_key on active meg_entities that lack one (property/org/person).
 *
 * Usage:
 *   op run --env-file=op.env -- node scripts/meg-dedup-stamp-existing.mjs --limit=200
 *   op run --env-file=op.env -- node scripts/meg-dedup-stamp-existing.mjs --dry-run --limit=50
 */
import { createClient } from '@supabase/supabase-js';

const eigenUrl =
  process.env.EIGEN_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  'https://zudslxucibosjwefojtm.supabase.co';
const serviceKey =
  process.env.EIGEN_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const limit = Number.parseInt(
  process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '200',
  10,
);
const dryRun = process.argv.includes('--dry-run');

if (!serviceKey) {
  console.error('Set EIGEN_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const eigen = createClient(eigenUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function hintsFromRow(row) {
  const attrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
  const nested = attrs.hints && typeof attrs.hints === 'object' ? attrs.hints : attrs;
  const email = nested.email ?? nested.canonical_email ?? row.external_ids?.primary_email ?? null;
  return {
    display_name: row.canonical_name,
    email,
    address: nested.address ?? nested.street ?? null,
    city: nested.city ?? null,
    state: nested.state ?? null,
  };
}

async function main() {
  const { data: raw, error } = await eigen
    .from('meg_entities')
    .select('id, canonical_name, entity_type, external_ids, metadata, attributes')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(Math.max(limit * 3, limit));

  if (error) throw error;

  const rows = (raw ?? [])
    .filter((row) => {
      const key = row.external_ids?.meg_dedup_key;
      return key == null || String(key).trim() === '';
    })
    .slice(0, limit);

  let stamped = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const catalog =
      row.metadata?.meg_catalog_entity_type ??
      (row.entity_type === 'property'
        ? 'meg:property'
        : row.entity_type === 'person'
          ? 'meg:person'
          : 'meg:org');

    const hints = hintsFromRow(row);
    const { data: dedupKey, error: rpcErr } = await eigen.rpc('meg_compute_dedup_key', {
      p_entity_type: catalog,
      p_canonical_name: row.canonical_name,
      p_canonical_email: hints.email,
      p_payload: { hints },
    });

    if (rpcErr) {
      failed += 1;
      console.warn('FAIL', row.id, rpcErr.message);
      continue;
    }
    if (!dedupKey) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log('DRY', row.id, row.canonical_name, '→', dedupKey);
      stamped += 1;
      continue;
    }

    const ext = { ...(row.external_ids ?? {}), meg_dedup_key: dedupKey };
    const { error: updErr } = await eigen
      .from('meg_entities')
      .update({ external_ids: ext })
      .eq('id', row.id);

    if (updErr) {
      failed += 1;
      console.warn('FAIL update', row.id, updErr.message);
    } else {
      stamped += 1;
      console.log('OK', row.id, dedupKey);
    }
  }

  console.log(
    `${dryRun ? 'dry-run ' : ''}done: stamped=${stamped} skipped=${skipped} failed=${failed} scanned=${(rows ?? []).length}`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
