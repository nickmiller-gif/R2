#!/usr/bin/env bash
# Verify Eigen ingest footprint on a Supabase project using the service role.
#
# Setup (once):
#   cd R2
#   cp .env.supabase.verify.example .env.supabase.local
#   # put SUPABASE_SERVICE_ROLE_KEY in .env.supabase.local (never commit)
#
# Run:
#   cd R2 && set -a && source .env.supabase.local && set +a && ./scripts/verify-eigen-ecosystem-ingest.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="$ROOT/.env.supabase.local"

if [[ -f "$LOCAL_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$LOCAL_ENV"
  set +a
fi

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  echo "Create ${LOCAL_ENV} from .env.supabase.verify.example, then:"
  echo "  cd R2 && set -a && source .env.supabase.local && set +a && ./scripts/verify-eigen-ecosystem-ingest.sh"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "This script requires jq (brew install jq)."
  exit 1
fi

BASE="${SUPABASE_URL%/}"
HDR=(
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
  -H "Content-Type: application/json"
)

echo "=== Eigen ingest verification (${BASE}) ==="
echo

# --- documents ---
DOC_SEL='id,source_system,embedding_status'
DOCS_JSON="$(curl -sS "${BASE}/rest/v1/documents?select=${DOC_SEL}&order=source_system.asc" "${HDR[@]}")"
if echo "$DOCS_JSON" | jq -e 'type == "object" and has("code")' >/dev/null 2>&1; then
  echo "documents query failed:"
  echo "$DOCS_JSON" | jq .
  exit 1
fi
if echo "$DOCS_JSON" | jq -e 'type == "object" and has("message")' >/dev/null 2>&1; then
  echo "documents query failed:"
  echo "$DOCS_JSON" | jq .
  exit 1
fi

DOC_TOTAL="$(echo "$DOCS_JSON" | jq 'length')"
echo "documents rows: ${DOC_TOTAL}"
echo "$DOCS_JSON" | jq -r '
  group_by(.source_system)[]
  | {
      source_system: (.[0].source_system),
      docs: length,
      embedded: map(select(.embedding_status == "embedded")) | length
    }
  | "\(.source_system)\t\(.docs) docs\t\(.embedded) embedded"
' | sort
echo

# --- knowledge_chunks (paginate) ---
CHUNK_PAGE_SIZE=1000
OFFSET=0
CHUNKS_JSON='[]'

while true; do
  PAGE="$(curl -sS \
    "${BASE}/rest/v1/knowledge_chunks?select=id,document_id,embedding,policy_tags,documents(source_system)&order=id.asc&limit=${CHUNK_PAGE_SIZE}&offset=${OFFSET}" \
    "${HDR[@]}")"
  if echo "$PAGE" | jq -e 'type == "object" and (has("code") or has("message"))' >/dev/null 2>&1; then
    echo "knowledge_chunks query failed:"
    echo "$PAGE" | jq .
    exit 1
  fi
  COUNT="$(echo "$PAGE" | jq 'length')"
  CHUNKS_JSON="$(jq -s '.[0] + .[1]' <<<"$CHUNKS_JSON"$'\n'"$PAGE")"
  if [[ "$COUNT" -lt "$CHUNK_PAGE_SIZE" ]]; then
    break
  fi
  OFFSET=$((OFFSET + CHUNK_PAGE_SIZE))
done

CHUNK_TOTAL="$(echo "$CHUNKS_JSON" | jq 'length')"
EMB_COUNT="$(echo "$CHUNKS_JSON" | jq '[.[] | select(.embedding != null)] | length')"
EIGEN_PUBLIC_COUNT="$(echo "$CHUNKS_JSON" | jq '[.[] | select(
  (.policy_tags | type == "array") and (.policy_tags | index("eigen_public") != null)
)] | length')"

echo "knowledge_chunks rows: ${CHUNK_TOTAL}"
echo "knowledge_chunks with non-null embedding: ${EMB_COUNT}"
echo "knowledge_chunks with policy_tags including eigen_public: ${EIGEN_PUBLIC_COUNT}"
echo

echo "chunks by document source_system (eigen_public = count of chunks tagged for anonymous retrieval):"
echo "$CHUNKS_JSON" | jq -r '
  group_by(.documents.source_system // "unknown")[]
  | {
      ss: (.[0].documents.source_system // "unknown"),
      n: length,
      emb: map(select(.embedding != null)) | length,
      pub: map(select((.policy_tags | type == "array") and (.policy_tags | index("eigen_public") != null))) | length
    }
  | "\(.ss)\t\(.n) chunks\t\(.emb) emb\t\(.pub) eigen_public"
' | sort

echo
echo "Done."
