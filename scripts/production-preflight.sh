#!/usr/bin/env bash
set -euo pipefail

echo "=== R2 production preflight ==="

required_env=(
  "SUPABASE_PROJECT_REF"
  "SUPABASE_ACCESS_TOKEN"
  "SUPABASE_DB_PASSWORD"
)

missing=0
for key in "${required_env[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Missing required env: $key"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Preflight failed: missing required deployment env."
  exit 1
fi

echo "1) Quality gate"
npm run check

echo "2) Link Supabase project"
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"

echo "3) Dry-run migration status"
supabase migration list --linked

echo "Preflight complete."
