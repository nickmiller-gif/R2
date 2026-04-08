#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi
if [[ -z "${AUTH_BEARER:-}" ]]; then
  echo "Missing AUTH_BEARER"
  exit 1
fi
if [[ -z "${INPUT_DIR:-}" ]]; then
  echo "Missing INPUT_DIR"
  exit 1
fi
if [[ -z "${SOURCE_SYSTEM:-}" ]]; then
  echo "Missing SOURCE_SYSTEM"
  exit 1
fi

ROOT_DIR="$(cd "$INPUT_DIR" && pwd)"
SOURCE_REF_PREFIX="${SOURCE_REF_PREFIX:-bulk}"
CHUNKING_MODE="${CHUNKING_MODE:-hierarchical}"
POLICY_TAGS="${POLICY_TAGS:-}"
ENTITY_IDS="${ENTITY_IDS:-}"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-}"
DRY_RUN="${DRY_RUN:-false}"
ALLOWED_EXTENSIONS="${ALLOWED_EXTENSIONS:-.txt,.md,.csv,.pdf,.docx}"

API_URL="${SUPABASE_URL%/}/functions/v1/eigen-ingest"

content_type_for_file() {
  local file="$1"
  case "${file,,}" in
    *.txt) echo "text/plain" ;;
    *.md) echo "text/markdown" ;;
    *.csv) echo "text/csv" ;;
    *.pdf) echo "application/pdf" ;;
    *.docx) echo "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ;;
    *) echo "application/octet-stream" ;;
  esac
}

echo "Scanning files under: ${ROOT_DIR}"
echo "Source system: ${SOURCE_SYSTEM}"
echo "Chunking mode: ${CHUNKING_MODE}"
echo "Allowed extensions: ${ALLOWED_EXTENSIONS}"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run: enabled (no API calls)"
fi
echo

success=0
failed=0
scanned=0
tmp_failures="$(mktemp)"

while IFS= read -r -d '' file; do
  scanned=$((scanned + 1))
  rel="${file#"$ROOT_DIR"/}"
  source_ref="${SOURCE_REF_PREFIX}:${rel}"
  title="$(basename "$file")"
  content_type="$(content_type_for_file "$file")"
  idem_hash="$(printf '%s' "$source_ref" | shasum -a 256 | cut -d ' ' -f1)"
  idem_key="bulk-${idem_hash}"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] ${source_ref}"
    success=$((success + 1))
    continue
  fi

  response_file="$(mktemp)"
  http_code="$(
    curl -sS \
      -o "$response_file" \
      -w "%{http_code}" \
      -X POST "$API_URL" \
      -H "Authorization: Bearer ${AUTH_BEARER}" \
      -H "X-Idempotency-Key: ${idem_key}" \
      -F "source_system=${SOURCE_SYSTEM}" \
      -F "source_ref=${source_ref}" \
      -F "title=${title}" \
      -F "content_type=${content_type}" \
      -F "chunking_mode=${CHUNKING_MODE}" \
      -F "policy_tags=${POLICY_TAGS}" \
      -F "entity_ids=${ENTITY_IDS}" \
      -F "embedding_model=${EMBEDDING_MODEL}" \
      -F "file=@${file};type=${content_type}"
  )"

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    chunks_created="$(python3 - "$response_file" <<'PY'
import json
import sys
path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    print(payload.get("chunks_created", 0))
except Exception:
    print("?")
PY
)"
    echo "[OK] ${source_ref} (chunks=${chunks_created})"
    success=$((success + 1))
  else
    message="$(python3 - "$response_file" <<'PY'
import json
import sys
path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    if isinstance(payload, dict):
        print(payload.get("error") or payload.get("message") or str(payload))
    else:
        print(str(payload))
except Exception:
    try:
        with open(path, "r", encoding="utf-8") as f:
            print(f.read().strip())
    except Exception:
        print("unknown error")
PY
)"
    echo "[FAIL] ${source_ref} (http=${http_code}) ${message}"
    echo "${file}" >> "$tmp_failures"
    failed=$((failed + 1))
  fi
  rm -f "$response_file"
done < <(python3 - "$ROOT_DIR" "$ALLOWED_EXTENSIONS" <<'PY'
import os
import sys

root = sys.argv[1]
exts = {part.strip().lower() for part in sys.argv[2].split(",") if part.strip()}
for base, _, files in os.walk(root):
    for name in files:
        lower = name.lower()
        if exts and not any(lower.endswith(ext) for ext in exts):
            continue
        print(os.path.join(base, name), end="\0")
PY
)

echo
echo "Bulk ingest summary:"
echo "- scanned: ${scanned}"
echo "- succeeded: ${success}"
echo "- failed: ${failed}"

if [[ "$failed" -gt 0 ]]; then
  echo
  echo "Failed files:"
  sed 's/^/- /' "$tmp_failures"
  rm -f "$tmp_failures"
  exit 1
fi

rm -f "$tmp_failures"
