#!/usr/bin/env bash
# Ingest public corpus for all registered Eigen sites.
#
# Reads config/eigen-sites.json and runs the standard ingest pipeline per site.
# Each site can have sitemaps, RSS feeds, and/or a files directory.
#
# Required env:
#   SUPABASE_URL
#   AUTH_BEARER   — member JWT
#
# Usage:
#   ./scripts/eigen-ingest-all-sites.sh              # all sites
#   ./scripts/eigen-ingest-all-sites.sh hpseller      # single site
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIG="config/eigen-sites.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "Missing $CONFIG" >&2
  exit 1
fi

if [[ -z "${SUPABASE_URL:-}" || -z "${AUTH_BEARER:-}" ]]; then
  echo "Set SUPABASE_URL and AUTH_BEARER" >&2
  exit 1
fi

FILTER="${1:-}"

# Parse site IDs from JSON (requires jq or python3)
if command -v jq &>/dev/null; then
  SITES=$(jq -r '.sites | keys[]' "$CONFIG")
else
  SITES=$(python3 -c "import json,sys; d=json.load(open('$CONFIG')); print('\n'.join(d['sites'].keys()))")
fi

TOTAL=0
PASS=0
FAIL=0

for SITE_ID in $SITES; do
  if [[ -n "$FILTER" && "$SITE_ID" != "$FILTER" ]]; then
    continue
  fi

  echo ""
  echo "=========================================="
  echo "  Site: $SITE_ID"
  echo "=========================================="
  TOTAL=$((TOTAL + 1))

  # Read site config with python3 (always available)
  SITE_CONFIG=$(python3 -c "
import json, sys
cfg = json.load(open('$CONFIG'))['sites']['$SITE_ID']
print(json.dumps(cfg))
")

  SITEMAPS=$(echo "$SITE_CONFIG" | python3 -c "import json,sys; print(','.join(json.load(sys.stdin).get('sitemaps',[])))")
  RSS_FEEDS=$(echo "$SITE_CONFIG" | python3 -c "import json,sys; print(','.join(json.load(sys.stdin).get('rss_feeds',[])))")
  FILES_DIR=$(echo "$SITE_CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin).get('files_dir',''))")

  HAS_WORK=false

  # Sitemap ingest
  if [[ -n "$SITEMAPS" ]]; then
    HAS_WORK=true
    echo "--- Sitemaps: $SITEMAPS ---"
    EIGEN_PUBLIC_SITEMAP_URLS="$SITEMAPS" python3 scripts/eigen-public-sitemap-ingest.py || true
  fi

  # RSS ingest
  if [[ -n "$RSS_FEEDS" ]]; then
    HAS_WORK=true
    echo "--- RSS: $RSS_FEEDS ---"
    EIGEN_PUBLIC_RSS_URLS="$RSS_FEEDS" python3 scripts/eigen-public-rss-ingest.py || true
  fi

  # File sync
  if [[ -n "$FILES_DIR" && -d "$FILES_DIR" ]]; then
    FILE_COUNT=$(find "$FILES_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')
    if [[ "$FILE_COUNT" -gt 0 ]]; then
      HAS_WORK=true
      echo "--- Files ($FILE_COUNT in $FILES_DIR) ---"
      INPUT_DIR="$FILES_DIR" \
      SOURCE_SYSTEM="$SITE_ID" \
      SOURCE_REF_PREFIX="$SITE_ID" \
      POLICY_TAGS="eigen_public" \
      MANIFEST_PATH="$FILES_DIR/.manifest.json" \
        ./scripts/eigen-ingest-sync.sh || true
    else
      echo "--- Files: $FILES_DIR exists but is empty ---"
    fi
  fi

  if [[ "$HAS_WORK" == false ]]; then
    echo "--- No sources configured yet for $SITE_ID ---"
  fi

  PASS=$((PASS + 1))
done

echo ""
echo "=== All sites done: $PASS/$TOTAL ==="
