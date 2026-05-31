#!/usr/bin/env node
/**
 * Record REGENT's financial inputs (treasury, per-domain economics,
 * cost-of-capital, committed inflows) into the Eigen `regent_world_state` table.
 * The autonomous bot reads the latest row each run, so this is how the
 * principal's ATTESTED numbers light up the Capital / Commercial faculties.
 *
 * Never fabricates: it writes exactly what is in the file you pass.
 *
 *   node scripts/regent-set-financials.mjs ./regent.financials.json
 *   node scripts/regent-set-financials.mjs ./regent.financials.example.json   # illustrative
 *
 * Requires a service-role token (SUPABASE_SERVICE_ROLE_KEY) in the environment.
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'regent.financials.json';
const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SRK) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is required (service-role write to regent_world_state).',
  );
  process.exit(1);
}

let fin;
try {
  fin = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Could not read ${file}:`, err.message);
  process.exit(1);
}

const row = {
  as_of: fin.as_of ?? new Date().toISOString().slice(0, 10),
  cash_on_hand: fin.cash_on_hand ?? null,
  cost_of_capital_pct: fin.cost_of_capital_pct ?? null,
  runway_floor_months: fin.runway_floor_months ?? null,
  domains: fin.domains ?? [],
  committed_inflows: fin.committed_inflows ?? [],
  funding: fin.funding ?? null,
  source: fin.source ?? 'principal',
  note: fin.note ?? null,
};

const res = await fetch(`${EIGEN_URL}/rest/v1/regent_world_state`, {
  method: 'POST',
  headers: {
    apikey: SRK,
    authorization: `Bearer ${SRK}`,
    'content-type': 'application/json',
    prefer: 'return=representation',
  },
  body: JSON.stringify(row),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}
console.log(JSON.stringify({ status: res.status, file, source: row.source, body }, null, 2));
process.exit(res.ok ? 0 : 1);
