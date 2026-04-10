#!/usr/bin/env bash
# check-supabase-generated-types.sh — verifies database.types.ts matches live schema.
set -euo pipefail

echo "=== Supabase Generated Types Check ==="

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
TYPES_FILE="database.types.ts"

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Skipping typegen check: SUPABASE_PROJECT_REF and/or SUPABASE_ACCESS_TOKEN not set."
  exit 0
fi

if [ ! -f "$TYPES_FILE" ]; then
  echo "FAIL: $TYPES_FILE does not exist."
  exit 1
fi

GENERATED_FILE="$(mktemp)"
trap 'rm -f "$GENERATED_FILE"' EXIT

npx --yes supabase@latest gen types typescript --project-id "$PROJECT_REF" --schema public > "$GENERATED_FILE"

if ! cmp -s "$TYPES_FILE" "$GENERATED_FILE"; then
  echo "FAIL: $TYPES_FILE is out of date with Supabase schema."
  echo "Run:"
  echo "  npx supabase gen types typescript --project-id \"$PROJECT_REF\" --schema public > $TYPES_FILE"
  exit 1
fi

echo "Generated types are up to date."

