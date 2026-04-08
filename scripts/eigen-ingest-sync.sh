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

INPUT_DIR_ABS="$(cd "$INPUT_DIR" && pwd)"
MANIFEST_PATH="${MANIFEST_PATH:-${INPUT_DIR_ABS}/.eigen-ingest-manifest.json}"
SOURCE_REF_PREFIX="${SOURCE_REF_PREFIX:-sync}"
CHUNKING_MODE="${CHUNKING_MODE:-hierarchical}"
POLICY_TAGS="${POLICY_TAGS:-}"
ENTITY_IDS="${ENTITY_IDS:-}"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-}"
ALLOWED_EXTENSIONS="${ALLOWED_EXTENSIONS:-.txt,.md,.csv,.pdf,.docx}"
DRY_RUN="${DRY_RUN:-false}"
PRUNE_MANIFEST_MISSING="${PRUNE_MANIFEST_MISSING:-false}"

API_URL="${SUPABASE_URL%/}/functions/v1/eigen-ingest"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FILES_JSON="${TMP_DIR}/files.json"
PLAN_JSON="${TMP_DIR}/plan.json"
UPDATED_MANIFEST_JSON="${TMP_DIR}/manifest.updated.json"

echo "Eigen sync starting..."
echo "- input_dir: ${INPUT_DIR_ABS}"
echo "- source_system: ${SOURCE_SYSTEM}"
echo "- source_ref_prefix: ${SOURCE_REF_PREFIX}"
echo "- chunking_mode: ${CHUNKING_MODE}"
echo "- manifest_path: ${MANIFEST_PATH}"
echo "- allowed_extensions: ${ALLOWED_EXTENSIONS}"
echo

python3 - "$INPUT_DIR_ABS" "$ALLOWED_EXTENSIONS" "$SOURCE_REF_PREFIX" > "$FILES_JSON" <<'PY'
import hashlib
import json
import os
import sys

root = sys.argv[1]
extensions = [part.strip().lower() for part in sys.argv[2].split(",") if part.strip()]
prefix = sys.argv[3]

files = []
for base, _, names in os.walk(root):
    for name in names:
        path = os.path.join(base, name)
        rel = os.path.relpath(path, root).replace("\\", "/")
        lower = rel.lower()
        if extensions and not any(lower.endswith(ext) for ext in extensions):
            continue
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        files.append({
            "rel_path": rel,
            "abs_path": path,
            "size_bytes": os.path.getsize(path),
            "sha256": h.hexdigest(),
            "source_ref": f"{prefix}:{rel}",
        })

files.sort(key=lambda row: row["rel_path"])
print(json.dumps({"files": files}, separators=(",", ":")))
PY

python3 - "$FILES_JSON" "$MANIFEST_PATH" > "$PLAN_JSON" <<'PY'
import json
import os
import sys

files_path = sys.argv[1]
manifest_path = sys.argv[2]

with open(files_path, "r", encoding="utf-8") as f:
    scanned = json.load(f).get("files", [])

manifest = {"version": 1, "files": {}}
if os.path.exists(manifest_path):
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            parsed = json.load(f)
            if isinstance(parsed, dict) and isinstance(parsed.get("files"), dict):
                manifest = parsed
    except Exception:
        pass

manifest_files = manifest.get("files", {})
local_map = {row["rel_path"]: row for row in scanned}
existing_keys = set(manifest_files.keys())
local_keys = set(local_map.keys())

to_ingest = []
for rel_path in sorted(local_keys):
    row = local_map[rel_path]
    prev = manifest_files.get(rel_path) or {}
    prev_hash = prev.get("sha256")
    if prev_hash != row["sha256"]:
        to_ingest.append({
            "reason": "new" if not prev_hash else "changed",
            **row,
        })

missing = sorted(existing_keys - local_keys)

print(json.dumps({
    "manifest": manifest,
    "to_ingest": to_ingest,
    "missing_from_disk": missing,
    "scanned_count": len(scanned),
    "ingest_count": len(to_ingest),
}, separators=(",", ":")))
PY

python3 - "$PLAN_JSON" <<'PY'
import json
import sys
plan = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(f"Scanned files: {plan['scanned_count']}")
print(f"Will ingest:   {plan['ingest_count']}")
print(f"Missing files: {len(plan['missing_from_disk'])}")
PY
echo

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run planned ingest list:"
  python3 - "$PLAN_JSON" <<'PY'
import json
import sys
plan = json.load(open(sys.argv[1], "r", encoding="utf-8"))
for item in plan["to_ingest"]:
    print(f"- [{item['reason']}] {item['source_ref']} sha={item['sha256'][:12]}")
PY
  exit 0
fi

success=0
failed=0

python3 - "$PLAN_JSON" "$UPDATED_MANIFEST_JSON" <<'PY'
import copy
import datetime as dt
import json
import sys

plan = json.load(open(sys.argv[1], "r", encoding="utf-8"))
manifest = plan["manifest"]
manifest.setdefault("version", 1)
manifest.setdefault("files", {})
manifest["generated_at"] = dt.datetime.utcnow().isoformat() + "Z"
json.dump(manifest, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=True, separators=(",", ":"))
PY

while IFS= read -r row; do
  rel_path="$(python3 - "$row" <<'PY'
import json,sys
print(json.loads(sys.argv[1])["rel_path"])
PY
)"
  abs_path="$(python3 - "$row" <<'PY'
import json,sys
print(json.loads(sys.argv[1])["abs_path"])
PY
)"
  source_ref="$(python3 - "$row" <<'PY'
import json,sys
print(json.loads(sys.argv[1])["source_ref"])
PY
)"
  sha256="$(python3 - "$row" <<'PY'
import json,sys
print(json.loads(sys.argv[1])["sha256"])
PY
)"
  reason="$(python3 - "$row" <<'PY'
import json,sys
print(json.loads(sys.argv[1])["reason"])
PY
)"

  idem_key="sync-${sha256}"
  content_type="application/octet-stream"
  case "${rel_path,,}" in
    *.txt) content_type="text/plain" ;;
    *.md) content_type="text/markdown" ;;
    *.csv) content_type="text/csv" ;;
    *.pdf) content_type="application/pdf" ;;
    *.docx) content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document" ;;
  esac

  response_file="${TMP_DIR}/resp.$RANDOM.json"
  http_code="$(
    curl -sS \
      -o "$response_file" \
      -w "%{http_code}" \
      -X POST "$API_URL" \
      -H "Authorization: Bearer ${AUTH_BEARER}" \
      -H "X-Idempotency-Key: ${idem_key}" \
      -F "source_system=${SOURCE_SYSTEM}" \
      -F "source_ref=${source_ref}" \
      -F "title=$(basename "$rel_path")" \
      -F "content_type=${content_type}" \
      -F "chunking_mode=${CHUNKING_MODE}" \
      -F "policy_tags=${POLICY_TAGS}" \
      -F "entity_ids=${ENTITY_IDS}" \
      -F "embedding_model=${EMBEDDING_MODEL}" \
      -F "file=@${abs_path};type=${content_type}"
  )"

  now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    chunks="$(python3 - "$response_file" <<'PY'
import json,sys
try:
  payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
  print(payload.get("chunks_created", 0))
except Exception:
  print("?")
PY
)"
    echo "[OK]   [${reason}] ${source_ref} (chunks=${chunks})"
    success=$((success + 1))

    python3 - "$UPDATED_MANIFEST_JSON" "$rel_path" "$sha256" "$source_ref" "$now_iso" <<'PY'
import json,sys
path, rel_path, sha256, source_ref, now_iso = sys.argv[1:6]
manifest = json.load(open(path, "r", encoding="utf-8"))
manifest.setdefault("files", {})
manifest["files"][rel_path] = {
  "sha256": sha256,
  "source_ref": source_ref,
  "last_ingested_at": now_iso,
  "last_status": "ok",
}
json.dump(manifest, open(path, "w", encoding="utf-8"), ensure_ascii=True, separators=(",", ":"))
PY
  else
    message="$(python3 - "$response_file" <<'PY'
import json,sys
try:
  payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
  if isinstance(payload, dict):
    print(payload.get("error") or payload.get("message") or str(payload))
  else:
    print(str(payload))
except Exception:
  print(open(sys.argv[1], "r", encoding="utf-8").read().strip() or "unknown error")
PY
)"
    echo "[FAIL] [${reason}] ${source_ref} (http=${http_code}) ${message}"
    failed=$((failed + 1))
  fi
done < <(python3 - "$PLAN_JSON" <<'PY'
import json,sys
plan = json.load(open(sys.argv[1], "r", encoding="utf-8"))
for row in plan["to_ingest"]:
  print(json.dumps(row, separators=(",", ":")))
PY
)

if [[ "$PRUNE_MANIFEST_MISSING" == "true" ]]; then
  python3 - "$UPDATED_MANIFEST_JSON" "$PLAN_JSON" <<'PY'
import json,sys
manifest_path, plan_path = sys.argv[1], sys.argv[2]
manifest = json.load(open(manifest_path, "r", encoding="utf-8"))
plan = json.load(open(plan_path, "r", encoding="utf-8"))
for rel_path in plan.get("missing_from_disk", []):
  manifest.get("files", {}).pop(rel_path, None)
json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=True, separators=(",", ":"))
PY
fi

mkdir -p "$(dirname "$MANIFEST_PATH")"
cp "$UPDATED_MANIFEST_JSON" "$MANIFEST_PATH"

missing_count="$(python3 - "$PLAN_JSON" <<'PY'
import json,sys
plan = json.load(open(sys.argv[1], "r", encoding="utf-8"))
print(len(plan.get("missing_from_disk", [])))
PY
)"

echo
echo "Sync summary:"
echo "- scanned: $(python3 - "$PLAN_JSON" <<'PY'
import json,sys
print(json.load(open(sys.argv[1], "r", encoding="utf-8"))["scanned_count"])
PY
)"
echo "- attempted: $(python3 - "$PLAN_JSON" <<'PY'
import json,sys
print(json.load(open(sys.argv[1], "r", encoding="utf-8"))["ingest_count"])
PY
)"
echo "- succeeded: ${success}"
echo "- failed: ${failed}"
echo "- missing_from_disk: ${missing_count}"
echo "- manifest: ${MANIFEST_PATH}"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
