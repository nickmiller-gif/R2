#!/usr/bin/env bash
# check-supabase-generated-types.sh — verifies database.types.ts matches live schema.
set -euo pipefail

echo "=== Supabase Generated Types Check ==="

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
TYPES_FILE="database.types.ts"
REQUIRE_REMOTE_CHECKS="${REQUIRE_SUPABASE_REMOTE_CHECKS:-false}"

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ]; then
  if [ "$REQUIRE_REMOTE_CHECKS" = "true" ]; then
    echo "FAIL: SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required for this check."
    exit 1
  fi
  echo "Skipping typegen check: SUPABASE_PROJECT_REF and/or SUPABASE_ACCESS_TOKEN not set."
  exit 0
fi

if [ ! -f "$TYPES_FILE" ]; then
  echo "FAIL: $TYPES_FILE does not exist."
  exit 1
fi

if [ "$REQUIRE_REMOTE_CHECKS" != "true" ]; then
  echo "Skipping typegen check: REQUIRE_SUPABASE_REMOTE_CHECKS is not true."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_CLI_VERSION="$(bash "$SCRIPT_DIR/supabase-cli-version.sh")"

GENERATED_FILE="$(mktemp)"
trap 'rm -f "$GENERATED_FILE"' EXIT

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript --project-id "$PROJECT_REF" --schema public > "$GENERATED_FILE"

if ! cmp -s "$TYPES_FILE" "$GENERATED_FILE"; then
  echo "FAIL: $TYPES_FILE is out of date with Supabase schema."
  echo "Run:"
  echo "  npx supabase@${SUPABASE_CLI_VERSION} gen types typescript --project-id \"$PROJECT_REF\" --schema public > $TYPES_FILE"
  exit 1
fi

echo "Generated types are up to date."

