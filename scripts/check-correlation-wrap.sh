#!/usr/bin/env bash
# check-correlation-wrap.sh — every Supabase edge function must wrap its
# Deno.serve handler in `withRequestMeta(...)` so inbound `x-correlation-id`
# / `x-idempotency-key` headers are honored and the response echoes the
# correlation ID back to the caller.
#
# This guard is cheap (grep) but catches the recurring class of bug where
# a new function ships without correlation propagation, leaving operators
# blind in logs. Skipping `_shared/` because those files are libraries,
# not entrypoints.

set -euo pipefail

EDGE_DIR="supabase/functions"

echo "=== Edge Function withRequestMeta Guard ==="

if [ ! -d "$EDGE_DIR" ]; then
  echo "No $EDGE_DIR directory found — nothing to check."
  exit 0
fi

MISSING=()
while IFS= read -r -d '' file; do
  # Only look at real function entrypoints.
  [[ "$file" == *"/_shared/"* ]] && continue
  # Library-only `_shared/**` is handled above; still, double-check we have an
  # actual Deno.serve call (otherwise it's a helper file and doesn't need wrapping).
  if ! grep -q 'Deno\.serve' "$file"; then
    continue
  fi
  if ! grep -q 'withRequestMeta' "$file"; then
    MISSING+=("$file")
  fi
done < <(find "$EDGE_DIR" -type f -name 'index.ts' -print0 | sort -z)

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo ""
  echo "FAIL: Edge function entrypoints missing withRequestMeta(...) wrapper:"
  for file in "${MISSING[@]}"; do
    echo "  - $file"
  done
  echo ""
  echo "Every Deno.serve callback in $EDGE_DIR must be wrapped in"
  echo "withRequestMeta(...) from supabase/functions/_shared/correlation.ts so"
  echo "correlation-id and idempotency-key headers are honored."
  exit 1
fi

echo "PASS: All edge function entrypoints wrap their Deno.serve handler in withRequestMeta."
