#!/usr/bin/env bash
# Regenerate database.types.ts from the linked Supabase project (public schema).
# Pin matches scripts/supabase-cli-version.sh and CI (see scripts/check-supabase-generated-types.sh).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

SUPABASE_CLI_VERSION="$(bash "$SCRIPT_DIR/supabase-cli-version.sh")"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (same as GitHub Actions secrets), then re-run." >&2
  echo "Example: export SUPABASE_ACCESS_TOKEN=…  export SUPABASE_PROJECT_REF=zudslxucibosjwefojtm" >&2
  exit 1
fi

OUT="database.types.ts"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
  --project-id "$SUPABASE_PROJECT_REF" \
  --schema public > "$TMP"

mv "$TMP" "$OUT"
trap - EXIT
echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes). Review and commit from this R2 checkout."
