#!/usr/bin/env bash
# check-supabase-migration-drift.sh — compares local migration history to linked remote.
set -euo pipefail

echo "=== Supabase Migration Drift Check ==="

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
REQUIRE_REMOTE_CHECKS="${REQUIRE_SUPABASE_REMOTE_CHECKS:-false}"

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ]; then
  if [ "$REQUIRE_REMOTE_CHECKS" = "true" ]; then
    echo "FAIL: SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required for this check."
    exit 1
  fi
  echo "Skipping drift check: SUPABASE_PROJECT_REF and/or SUPABASE_ACCESS_TOKEN not set."
  exit 0
fi

if [ "$REQUIRE_REMOTE_CHECKS" != "true" ]; then
  echo "Skipping drift check: REQUIRE_SUPABASE_REMOTE_CHECKS is not true."
  exit 0
fi

OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_CLI_VERSION="$(bash "$SCRIPT_DIR/supabase-cli-version.sh")"

if ! npx --yes "supabase@${SUPABASE_CLI_VERSION}" link --project-ref "$PROJECT_REF" 2>&1; then
  echo "FAIL: Unable to link Supabase project $PROJECT_REF"
  exit 1
fi

if ! npx --yes "supabase@${SUPABASE_CLI_VERSION}" migration list --linked >"$OUTPUT_FILE" 2>&1; then
  echo "FAIL: Unable to list Supabase migrations for project $PROJECT_REF"
  cat "$OUTPUT_FILE"
  exit 1
fi

# Migration list should not include rows where local and remote are out of sync.
if grep -E -q "^\s*[0-9]{12}\s+\|\s+[^|]+\s+\|\s+[^|]+\s*$" "$OUTPUT_FILE"; then
  # Human-readable table emitted. Flag obvious mismatches where either side is missing.
  if grep -E -q "\|\s*$|\|\s*-\s*\|" "$OUTPUT_FILE"; then
    echo "FAIL: Local and remote migration histories appear out of sync."
    cat "$OUTPUT_FILE"
    exit 1
  fi
fi

echo "Supabase migration history check completed."

