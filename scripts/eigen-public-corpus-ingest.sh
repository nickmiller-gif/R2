#!/usr/bin/env bash
# Run all configured public corpus sources: sitemap crawl, RSS/news feeds, and/or
# a directory of files (via eigen-ingest → eigen_public).
#
# Required (always):
#   SUPABASE_URL
#   AUTH_BEARER   — member JWT (same as other ingest scripts)
#
# Configure at least one source:
#   EIGEN_PUBLIC_SITEMAP_URLS   — comma-separated sitemap URLs (optional)
#   EIGEN_PUBLIC_RSS_URLS       — comma-separated RSS/Atom feed URLs (optional)
#   EIGEN_PUBLIC_FILES_DIR      — directory of files to sync (optional)
#
# File sync extras (when EIGEN_PUBLIC_FILES_DIR is set):
#   EIGEN_PUBLIC_FILES_SOURCE_SYSTEM      (default: public-site-files)
#   EIGEN_PUBLIC_FILES_SOURCE_REF_PREFIX  (default: public)
#   EIGEN_PUBLIC_FILES_POLICY_TAGS        (default: eigen_public)
#   MANIFEST_PATH                         (optional; default under that dir)
#
# Optional Oracle outbox (after ingest; requires service_role JWT):
#   EIGEN_OUTBOX_DRAIN_BEARER — if set, POSTs eigen-oracle-outbox-drain (limit 50) when ingest finishes
#
# Resilience (optional):
#   EIGEN_PUBLIC_CORPUS_CONTINUE_ON_ERROR=1 — sitemap/RSS stages that hit partial 403/5xx do not abort
#     the rest of this script (file sync + outbox drain still run). Default: strict (fail fast).
#
# From repo root:
#   ./scripts/eigen-public-corpus-ingest.sh
#
# Or: make eigen-public-corpus

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SITEMAP="${EIGEN_PUBLIC_SITEMAP_URLS:-}"
RSS="${EIGEN_PUBLIC_RSS_URLS:-}"
FILES_DIR="${EIGEN_PUBLIC_FILES_DIR:-}"

if [[ -z "$SITEMAP" && -z "$RSS" && -z "$FILES_DIR" ]]; then
  echo "Set at least one of: EIGEN_PUBLIC_SITEMAP_URLS, EIGEN_PUBLIC_RSS_URLS, EIGEN_PUBLIC_FILES_DIR" >&2
  exit 1
fi

if [[ -z "${SUPABASE_URL:-}" || -z "${AUTH_BEARER:-}" ]]; then
  echo "Set SUPABASE_URL and AUTH_BEARER" >&2
  exit 1
fi

echo "=== Eigen public corpus ingest ==="

_continue() {
  if [[ "${EIGEN_PUBLIC_CORPUS_CONTINUE_ON_ERROR:-}" == "1" ]]; then
    "$@" || {
      echo "[warn] stage exited non-zero (continuing because EIGEN_PUBLIC_CORPUS_CONTINUE_ON_ERROR=1)" >&2
      return 0
    }
  else
    "$@"
  fi
}

if [[ -n "$SITEMAP" ]]; then
  echo "--- Sitemap ---"
  _continue python3 scripts/eigen-public-sitemap-ingest.py
else
  echo "--- Sitemap (skipped) ---"
fi

if [[ -n "$RSS" ]]; then
  echo "--- RSS / Atom (news) ---"
  _continue python3 scripts/eigen-public-rss-ingest.py
else
  echo "--- RSS (skipped) ---"
fi

if [[ -n "$FILES_DIR" ]]; then
  if [[ ! -d "$FILES_DIR" ]]; then
    echo "--- Public files: skip (not a directory: $FILES_DIR) ---" >&2
  else
    echo "--- Public files (directory sync) ---"
    export INPUT_DIR="$FILES_DIR"
    export SOURCE_SYSTEM="${EIGEN_PUBLIC_FILES_SOURCE_SYSTEM:-public-site-files}"
    export SOURCE_REF_PREFIX="${EIGEN_PUBLIC_FILES_SOURCE_REF_PREFIX:-public}"
    export POLICY_TAGS="${EIGEN_PUBLIC_FILES_POLICY_TAGS:-eigen_public}"
    if [[ -n "${EIGEN_PUBLIC_FILES_MANIFEST_PATH:-}" ]]; then
      export MANIFEST_PATH="$EIGEN_PUBLIC_FILES_MANIFEST_PATH"
    fi
    export PRUNE_MANIFEST_MISSING="${EIGEN_PUBLIC_FILES_PRUNE_MISSING:-false}"
    ./scripts/eigen-ingest-sync.sh
  fi
else
  echo "--- Public files (skipped) ---"
fi

if [[ -n "${EIGEN_OUTBOX_DRAIN_BEARER:-}" ]]; then
  echo "--- eigen-oracle-outbox-drain ---"
  base="${SUPABASE_URL%/}"
  _drain_tmp="$(mktemp)"
  _drain_code="$(curl -sS -o "${_drain_tmp}" -w '%{http_code}' -X POST "${base}/functions/v1/eigen-oracle-outbox-drain?limit=50" \
    -H "Authorization: Bearer ${EIGEN_OUTBOX_DRAIN_BEARER}" \
    -H "Content-Type: application/json" \
    -d '{}' )" || _drain_code="000"
  if [[ "${_drain_code}" != 2* ]]; then
    echo "eigen-oracle-outbox-drain HTTP ${_drain_code} (non-fatal):" >&2
    cat "${_drain_tmp}" >&2
  else
    cat "${_drain_tmp}"
  fi
  rm -f "${_drain_tmp}"
  echo ""
else
  echo "--- eigen-oracle-outbox-drain (skipped; set EIGEN_OUTBOX_DRAIN_BEARER to run) ---"
fi

echo "=== Done ==="
