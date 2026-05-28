#!/usr/bin/env node
/**
 * Replay KB-four platform_feed_items through MEG resolve + portfolio anchor edges.
 *
 *   op run --env-file=op.env -- node scripts/meg-kb-four-relink-feed.mjs
 *   op run --env-file=op.env -- node scripts/meg-kb-four-relink-feed.mjs --no-replay
 */

const EIGEN_URL =
  process.env.EIGEN_SUPABASE_URL?.replace(/\/+$/, '') ??
  process.env.SUPABASE_URL?.replace(/\/+$/, '') ??
  'https://zudslxucibosjwefojtm.supabase.co';

const bearer =
  process.env.MEG_BACKFILL_BEARER?.trim() ?? process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!bearer) {
  console.error('Set MEG_BACKFILL_BEARER or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const replay = !process.argv.includes('--no-replay');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 500;

const res = await fetch(`${EIGEN_URL}/functions/v1/meg-kb-four-backfill-links`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${bearer}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ replay_processing: replay, limit }),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log(JSON.stringify({ status: res.status, body }, null, 2));
process.exit(res.ok ? 0 : 1);
