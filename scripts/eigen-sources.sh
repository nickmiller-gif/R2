#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi

MODE="${1:-public}"
BASE="${SUPABASE_URL%/}/functions/v1"

if [[ "$MODE" == "public" ]]; then
  curl -sS "${BASE}/eigen-public-sources" | python3 -m json.tool
  exit 0
fi

if [[ "$MODE" == "eigenx" || "$MODE" == "all" ]]; then
  if [[ -z "${AUTH_BEARER:-}" ]]; then
    echo "Missing AUTH_BEARER for eigenx/all source inventory"
    exit 1
  fi
  curl -sS \
    -H "Authorization: Bearer ${AUTH_BEARER}" \
    "${BASE}/eigen-source-inventory" | python3 -m json.tool
  exit 0
fi

echo "Usage: $0 [public|eigenx|all]"
exit 1
