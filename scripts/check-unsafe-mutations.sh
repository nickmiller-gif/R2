#!/usr/bin/env bash
# check-unsafe-mutations.sh — detect raw body mass-assignment patterns in edge functions.
#
# Flags edge-function files that pass an unfiltered `body` variable directly
# to Supabase `.insert()` or `.update()` calls, which is a mass-assignment
# vulnerability.  The correct pattern is to explicitly allowlist fields before
# writing to the DB (see supabase/functions/_shared/validate.ts allowlistPayload).
#
# Patterns flagged:
#   .insert([body])   — unguarded whole-body insert
#   .update(body)     — unguarded whole-body update
#
# False-positive handling: lines that follow a comment `// allowed-unsafe` are
# excluded.  Use this escape hatch only when the body has already been filtered
# by an upstream function (e.g. buildSafeThesisPatch).
set -euo pipefail

EXIT=0
FUNCTIONS_DIR="supabase/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "No supabase/functions/ directory found — nothing to check."
  exit 0
fi

echo "=== Unsafe Mutation Pattern Check ==="

# Search for .insert([body]) — raw body passed directly to insert
INSERT_HITS=$(grep -rn "\.insert\(\[body\]\)" "$FUNCTIONS_DIR" \
  --include="*.ts" 2>/dev/null \
  | grep -v "// allowed-unsafe" || true)

# Search for .update(body) — raw body passed directly to update
UPDATE_HITS=$(grep -rn "\.update(body)" "$FUNCTIONS_DIR" \
  --include="*.ts" 2>/dev/null \
  | grep -v "// allowed-unsafe" || true)

if [ -n "$INSERT_HITS" ]; then
  echo ""
  echo "FAIL: Found .insert([body]) — raw body mass-assignment in insert:"
  echo "$INSERT_HITS"
  EXIT=1
fi

if [ -n "$UPDATE_HITS" ]; then
  echo ""
  echo "FAIL: Found .update(body) — raw body mass-assignment in update:"
  echo "$UPDATE_HITS"
  EXIT=1
fi

if [ $EXIT -eq 0 ]; then
  echo "PASS: No raw body mass-assignment patterns found."
fi

exit $EXIT
