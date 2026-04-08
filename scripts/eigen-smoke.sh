#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi

PUBLIC_URL="${PUBLIC_URL:-${SUPABASE_URL%/}/functions/v1/eigen-chat-public}"
EIGENX_URL="${EIGENX_URL:-${SUPABASE_URL%/}/functions/v1/eigen-chat}"

PUBLIC_QUESTION="${PUBLIC_QUESTION:-What is Rays Retreat focused on?}"
EIGENX_QUESTION="${EIGENX_QUESTION:-How should adapters ingest multi-domain knowledge into EigenX?}"

echo "== Public Eigen smoke test =="
public_payload=$(python3 - "$PUBLIC_QUESTION" <<'PY'
import json, sys
print(json.dumps({"message": sys.argv[1], "response_format": "structured"}))
PY
)

public_resp=$(curl -sS -X POST "$PUBLIC_URL" -H "Content-Type: application/json" --data "$public_payload")
echo "$public_resp"

if ! echo "$public_resp" | python3 - <<'PY'
import json, sys
try:
    body = json.loads(sys.stdin.read())
except Exception:
    raise SystemExit(1)
if "response" not in body:
    raise SystemExit(1)
PY
then
  echo "Public smoke test failed: missing response field"
  exit 1
fi

if [[ -z "${AUTH_BEARER:-}" ]]; then
  echo "Skipping EigenX smoke test (AUTH_BEARER not set)"
  exit 0
fi

echo "== EigenX smoke test =="
eigenx_payload=$(python3 - "$EIGENX_QUESTION" <<'PY'
import json, sys
print(json.dumps({
  "message": sys.argv[1],
  "response_format": "structured",
  "policy_scope": ["eigenx"]
}))
PY
)

eigenx_resp=$(curl -sS -X POST "$EIGENX_URL" \
  -H "Authorization: Bearer $AUTH_BEARER" \
  -H "Content-Type: application/json" \
  --data "$eigenx_payload")
echo "$eigenx_resp"

if ! echo "$eigenx_resp" | python3 - <<'PY'
import json, sys
try:
    body = json.loads(sys.stdin.read())
except Exception:
    raise SystemExit(1)
if "response" not in body or "retrieval_run_id" not in body:
    raise SystemExit(1)
PY
then
  echo "EigenX smoke test failed: missing expected fields"
  exit 1
fi

echo "Smoke tests passed."
