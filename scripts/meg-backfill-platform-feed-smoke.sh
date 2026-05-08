#!/usr/bin/env bash
# Operator smoke for Edge `meg-backfill-source` — `r2:platform_feed_items` adapter.
# Requires MEG_BACKFILL_BEARER in the environment (must match the Eigen Edge secret).
# Usage: from repo root `R2/`:
#   export MEG_BACKFILL_BEARER='…'   # from Supabase Dashboard → Edge secrets
#   bash scripts/meg-backfill-platform-feed-smoke.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R2_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Optional: read only MEG_BACKFILL_BEARER from gitignored `.env.wave1.local` (do not `source` the whole file).
WAVE1="$R2_ROOT/.env.wave1.local"
if [[ -z "${MEG_BACKFILL_BEARER:-}" && -f "$WAVE1" ]]; then
  line="$(grep -E '^[[:space:]]*MEG_BACKFILL_BEARER=' "$WAVE1" | tail -n1 || true)"
  if [[ -n "$line" ]]; then
    val="${line#*=}"
    val="${val%$'\r'}"
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    export MEG_BACKFILL_BEARER="$val"
  fi
fi

REF="${SUPABASE_EIGEN_PROJECT_REF:-zudslxucibosjwefojtm}"
URL="https://${REF}.supabase.co/functions/v1/meg-backfill-source"

if [[ -z "${MEG_BACKFILL_BEARER:-}" ]]; then
  echo "error: set MEG_BACKFILL_BEARER (same value as Edge secret on project ${REF})" >&2
  exit 2
fi

echo "== dry_run: true, max_batches: 1 =="
curl -fsS -X POST "$URL" \
  -H "Authorization: Bearer ${MEG_BACKFILL_BEARER}" \
  -H "Content-Type: application/json" \
  -d '{"source_system":"r2","source_table":"platform_feed_items","dry_run":true,"max_batches":1}'
echo ""

echo "== live: dry_run false, batch_size 500, max_batches 1 =="
curl -fsS -X POST "$URL" \
  -H "Authorization: Bearer ${MEG_BACKFILL_BEARER}" \
  -H "Content-Type: application/json" \
  -d '{"source_system":"r2","source_table":"platform_feed_items","dry_run":false,"batch_size":500,"max_batches":1}'
echo ""

echo "== Verify in SQL (service role / dashboard):"
echo "  select id, status, scanned, matched_existing, inserted_new, errors, left(notes,200) from public.meg_backfill_runs order by started_at desc limit 3;"
echo "  select count(*) filter (where actor_meg_entity_id is null) as actor_meg_null from public.platform_feed_items;"
