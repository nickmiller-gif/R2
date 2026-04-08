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

if [[ -n "$SITEMAP" ]]; then
  echo "--- Sitemap ---"
  python3 scripts/eigen-public-sitemap-ingest.py
else
  echo "--- Sitemap (skipped) ---"
fi

if [[ -n "$RSS" ]]; then
  echo "--- RSS / Atom (news) ---"
  python3 scripts/eigen-public-rss-ingest.py
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

echo "=== Done ==="
