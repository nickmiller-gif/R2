#!/usr/bin/env bash
# check-supabase-migration-drift.sh — compares local migration history to linked remote.
set -euo pipefail

echo "=== Supabase Migration Drift Check ==="

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Skipping drift check: SUPABASE_PROJECT_REF and/or SUPABASE_ACCESS_TOKEN not set."
  exit 0
fi

OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE"' EXIT

if ! npx --yes supabase@latest migration list --project-ref "$PROJECT_REF" >"$OUTPUT_FILE" 2>&1; then
  echo "FAIL: Unable to list Supabase migrations for project $PROJECT_REF"
  cat "$OUTPUT_FILE"
  exit 1
fi

# Migration list should not include rows where local and remote are out of sync.
if rg -n "^\s*[0-9]{12}\s+\|\s+[^|]+\s+\|\s+[^|]+\s*$" "$OUTPUT_FILE" >/dev/null; then
  # Human-readable table emitted. Flag obvious mismatches where either side is missing.
  if rg -n "\|\s*$|\|\s*-\s*\|" "$OUTPUT_FILE" >/dev/null; then
    echo "FAIL: Local and remote migration histories appear out of sync."
    cat "$OUTPUT_FILE"
    exit 1
  fi
fi

echo "Supabase migration history check completed."

