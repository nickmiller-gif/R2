#!/usr/bin/env bash
# check-migrations.sh — migration sanity checks for R2
# Validates naming convention (YYYYMMDDHHMM_snake_case.sql), ordering, and basic SQL hygiene.
set -euo pipefail

EXIT=0
MIGRATION_DIR="supabase/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "No supabase/migrations/ directory found — nothing to check."
  exit 0
fi

echo "=== Migration Sanity Check ==="

# 1. All files must match naming convention: numeric prefix (12–14 digits) + _description.sql
#    (14-digit prefixes appear when remote schema_migrations rows were created outside this repo.)
BAD_NAMES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | xargs -I{} basename {} | grep -vE '^[0-9]{12,14}_[a-z0-9_]+\.sql$' || true)
if [ -n "$BAD_NAMES" ]; then
  echo ""
  echo "FAIL: Migration files with non-standard names (expected YYYYMMDDHHMM_snake_case.sql):"
  echo "$BAD_NAMES"
  EXIT=1
fi

# 2. Check for duplicate migration version keys (digits before first underscore)
DUPES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | xargs -I{} basename {} | awk -F_ 'NF>=2 && $1 ~ /^[0-9]{12,14}$/{print $1}' | sort | uniq -d || true)
if [ -n "$DUPES" ]; then
  echo ""
  echo "FAIL: Duplicate migration timestamps found:"
  echo "$DUPES"
  for d in $DUPES; do
    ls "$MIGRATION_DIR"/${d}* 2>/dev/null | xargs -I{} basename {}
  done
  EXIT=1
fi

# 3. Check ordering — filenames must already be lexicographically ordered
ACTUAL_FILES=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | xargs -I{} basename {})
SORTED_FILES=$(printf '%s\n' "$ACTUAL_FILES" | sort)
if [ "$SORTED_FILES" != "$ACTUAL_FILES" ]; then
  echo ""
  echo "FAIL: Migration filenames are out of order."
  echo "Expected order:"
  printf '%s\n' "$SORTED_FILES"
  echo ""
  echo "Actual order:"
  printf '%s\n' "$ACTUAL_FILES"
  EXIT=1
fi

# 4. No destructive operations (additive-only policy)
DESTRUCTIVE_HITS=$(grep -rln "DROP TABLE\|DROP COLUMN\|DROP SCHEMA\|TRUNCATE\|DELETE FROM" "$MIGRATION_DIR"/ 2>/dev/null || true)
if [ -n "$DESTRUCTIVE_HITS" ]; then
  echo ""
  echo "WARNING: Migrations containing potentially destructive operations (additive-only policy):"
  for f in $DESTRUCTIVE_HITS; do
    echo "  $(basename "$f"):"
    grep -n "DROP TABLE\|DROP COLUMN\|DROP SCHEMA\|TRUNCATE\|DELETE FROM" "$f" | head -3
  done
fi

# 5. Count summary
TOTAL=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Total migrations: $TOTAL"

if [ $EXIT -eq 0 ]; then
  echo "PASS: All migration sanity checks passed."
fi

exit $EXIT
