#!/usr/bin/env node
/**
 * Backfill Eigen MEG + works.entities for existing CentralR2 Tower rows.
 *
 * Requires Tower edges `entity-eigen-sync` / `people-eigen-sync` deployed and secrets:
 *   MEG_RESOLVE_BRIDGE_*, EIGEN_SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   TOWER_SUPABASE_URL=... TOWER_SERVICE_ROLE_KEY=... \
 *   node scripts/centralr2-entity-meg-backfill.mjs --table=entities --limit=50
 *   node scripts/centralr2-entity-meg-backfill.mjs --table=people --limit=50
 *   node scripts/centralr2-entity-meg-backfill.mjs --table=all --limit=100
 */
import { createClient } from '@supabase/supabase-js';

const towerUrl = process.env.TOWER_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const towerKey =
  process.env.TOWER_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const limit = Number.parseInt(
  process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '100',
  10,
);
const tableArg = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1] ?? 'all';

if (!towerUrl || !towerKey) {
  console.error('Set TOWER_SUPABASE_URL and TOWER_SERVICE_ROLE_KEY (Tower project).');
  process.exit(1);
}

const tower = createClient(towerUrl, towerKey);

async function backfillEntities() {
  const { data: rows, error } = await tower
    .from('entities')
    .select('id, name, type')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  let ok = 0;
  let fail = 0;
  for (const row of rows ?? []) {
    const { data, error: fnErr } = await tower.functions.invoke('entity-eigen-sync', {
      body: { entity_id: row.id, name: row.name, type: row.type ?? 'llc' },
    });
    if (fnErr || !data?.ok) {
      fail += 1;
      console.warn('FAIL entity', row.id, row.name, fnErr?.message ?? data?.error ?? data?.hint);
    } else {
      ok += 1;
      console.log('OK entity', row.id, row.name, '→', data.meg_entity_id);
    }
  }
  console.log(`entities: ${ok} synced, ${fail} failed, ${(rows ?? []).length} scanned.`);
}

async function backfillPeople() {
  const { data: rows, error } = await tower
    .from('people')
    .select('id, full_name, email, company, title')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  let ok = 0;
  let fail = 0;
  for (const row of rows ?? []) {
    const { data, error: fnErr } = await tower.functions.invoke('people-eigen-sync', {
      body: {
        person_id: row.id,
        full_name: row.full_name,
        email: row.email,
        company: row.company,
        title: row.title,
      },
    });
    if (fnErr || !data?.ok) {
      fail += 1;
      console.warn(
        'FAIL person',
        row.id,
        row.full_name,
        fnErr?.message ?? data?.error ?? data?.hint,
      );
    } else {
      ok += 1;
      console.log('OK person', row.id, row.full_name, '→', data.meg_entity_id);
    }
  }
  console.log(`people: ${ok} synced, ${fail} failed, ${(rows ?? []).length} scanned.`);
}

try {
  if (tableArg === 'entities' || tableArg === 'all') await backfillEntities();
  if (tableArg === 'people' || tableArg === 'all') await backfillPeople();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
