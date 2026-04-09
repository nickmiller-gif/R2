#!/usr/bin/env bash
# check-migrations.sh — migration sanity checks for R2
# Validates naming convention, ordering, and basic SQL hygiene.
set -euo pipefail

EXIT=0
MIGRATION_DIR="supabase/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "No supabase/migrations/ directory found — nothing to check."
  exit 0
fi

echo "=== Migration Sanity Check ==="

# 1. All files must match naming convention: YYYYMMDDNNNN_description.sql
BAD_NAMES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | xargs -I{} basename {} | grep -vE '^[0-9]{12}_[a-z0-9_]+\.sql$' || true)
if [ -n "$BAD_NAMES" ]; then
  echo ""
  echo "FAIL: Migration files with non-standard names (expected YYYYMMDDNNNN_snake_case.sql):"
  echo "$BAD_NAMES"
  EXIT=1
fi

# 2. Check for duplicate prefixes (same timestamp)
DUPES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | xargs -I{} basename {} | cut -c1-12 | sort | uniq -d || true)
if [ -n "$DUPES" ]; then
  echo ""
  echo "FAIL: Duplicate migration timestamps found:"
  echo "$DUPES"
  for d in $DUPES; do
    ls "$MIGRATION_DIR"/${d}* 2>/dev/null | xargs -I{} basename {}
  done
  EXIT=1
fi

# 3. No destructive operations (additive-only policy)
DESTRUCTIVE_HITS=$(grep -riln "DROP TABLE\|DROP COLUMN\|DROP SCHEMA\|TRUNCATE\|DELETE FROM" "$MIGRATION_DIR"/ 2>/dev/null || true)
if [ -n "$DESTRUCTIVE_HITS" ]; then
  echo ""
  echo "FAIL: Migrations containing destructive operations violate the additive-only policy:"
  for f in $DESTRUCTIVE_HITS; do
    echo "  $(basename "$f"):"
    grep -in "DROP TABLE\|DROP COLUMN\|DROP SCHEMA\|TRUNCATE\|DELETE FROM" "$f" | head -3
  done
  EXIT=1
fi

# 4. Count summary
TOTAL=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Total migrations: $TOTAL"

if [ $EXIT -eq 0 ]; then
  echo "PASS: All migration sanity checks passed."
fi

exit $EXIT
