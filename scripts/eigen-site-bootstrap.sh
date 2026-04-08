#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi
if [[ -z "${SITE_ID:-}" ]]; then
  echo "Missing SITE_ID"
  exit 1
fi
if [[ -z "${SITE_NAME:-}" ]]; then
  echo "Missing SITE_NAME"
  exit 1
fi
if [[ -z "${WIDGET_HOST:-}" ]]; then
  echo "Missing WIDGET_HOST (example: https://eigen.pages.dev)"
  exit 1
fi
if [[ -z "${SITE_ORIGINS:-}" ]]; then
  echo "Missing SITE_ORIGINS (comma-separated origins allowed to call eigen-widget-session)"
  exit 1
fi

SITE_MODE="${SITE_MODE:-public}"
if [[ "$SITE_MODE" != "public" && "$SITE_MODE" != "eigenx" && "$SITE_MODE" != "mixed" ]]; then
  echo "Invalid SITE_MODE: ${SITE_MODE} (expected public|eigenx|mixed)"
  exit 1
fi

SOURCE_SYSTEMS_CSV="${SITE_SOURCE_SYSTEMS:-}"
POLICY_SCOPE_CSV="${SITE_POLICY_SCOPE:-}"
METADATA_JSON="${SITE_METADATA_JSON:-{\"provisioned_by\":\"scripts/eigen-site-bootstrap.sh\"}}"

to_json_array_from_csv() {
  local value="${1:-}"
  python3 - "$value" <<'PY'
import json
import sys

raw = sys.argv[1] if len(sys.argv) > 1 else ""
items = [part.strip() for part in raw.split(",") if part.strip()]
print(json.dumps(items))
PY
}

if [[ -z "${POLICY_SCOPE_CSV}" ]]; then
  case "$SITE_MODE" in
    public)
      POLICY_SCOPE_CSV="eigen_public"
      ;;
    eigenx)
      POLICY_SCOPE_CSV="eigenx"
      ;;
    mixed)
      POLICY_SCOPE_CSV="eigen_public,eigenx"
      ;;
  esac
fi

ORIGINS_JSON="$(to_json_array_from_csv "$SITE_ORIGINS")"
SOURCE_SYSTEMS_JSON="$(to_json_array_from_csv "$SOURCE_SYSTEMS_CSV")"
POLICY_SCOPE_JSON="$(to_json_array_from_csv "$POLICY_SCOPE_CSV")"

payload="$(
python3 - "$SITE_ID" "$SITE_NAME" "$SITE_MODE" "$ORIGINS_JSON" "$SOURCE_SYSTEMS_JSON" "$POLICY_SCOPE_JSON" "$METADATA_JSON" <<'PY'
import json
import sys

site_id = sys.argv[1]
site_name = sys.argv[2]
site_mode = sys.argv[3]
origins = json.loads(sys.argv[4])
source_systems = json.loads(sys.argv[5])
policy_scope = json.loads(sys.argv[6])
metadata = json.loads(sys.argv[7])

print(json.dumps([{
    "site_id": site_id,
    "display_name": site_name,
    "mode": site_mode,
    "origins": origins,
    "source_systems": source_systems,
    "default_policy_scope": policy_scope,
    "status": "active",
    "metadata": metadata
}], separators=(",", ":")))
PY
)"

REST_BASE="${SUPABASE_URL%/}/rest/v1"
API_BASE="${SUPABASE_URL%/}/functions/v1"

echo "Upserting site registry row for ${SITE_ID}..."
upsert_response="$(
curl -sSf \
  -X POST "${REST_BASE}/eigen_site_registry?on_conflict=site_id" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  --data "$payload"
)"
python3 -m json.tool <<<"$upsert_response"

WIDGET_HOST_NORMALIZED="${WIDGET_HOST%/}"
PUBLIC_URL="${WIDGET_HOST_NORMALIZED}/index.html?api_base=${API_BASE}&site_id=${SITE_ID}&mode=public"
EIGENX_URL="${WIDGET_HOST_NORMALIZED}/index.html?api_base=${API_BASE}&site_id=${SITE_ID}&mode=eigenx"

echo
echo "Public iframe:"
cat <<EOF
<iframe
  src="${PUBLIC_URL}"
  title="Eigen Chat"
  style="width:100%;max-width:420px;height:620px;border:0"
  loading="lazy"
></iframe>
EOF

echo
echo "EigenX iframe (recommended parent_origin pinning):"
cat <<EOF
<iframe
  id="eigenx-frame"
  src="${EIGENX_URL}&parent_origin=https://your-site-origin.com"
  title="EigenX Chat"
  style="width:100%;max-width:420px;height:620px;border:0"
  loading="lazy"
></iframe>
<script>
  const frame = document.getElementById('eigenx-frame');
  // authBearer must be your logged-in user access token.
  frame.contentWindow.postMessage({ type: 'eigen_widget_auth', authBearer }, 'https://your-site-origin.com');
</script>
EOF
