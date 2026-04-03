#!/usr/bin/env bash
# check-banned-imports.sh — enforce R2 clean-core import boundaries
# Part 3 of the R2 setup plan: no monorepo aliases, no deep relative paths,
# no module-load-time Supabase client instantiation.
set -euo pipefail

EXIT=0
SRC_DIR="src"

if [ ! -d "$SRC_DIR" ]; then
  echo "No src/ directory found — nothing to check."
  exit 0
fi

echo "=== Banned Import Check ==="

# 1. Ban @/... imports (monorepo alias from raysretreat)
ALIAS_HITS=$(grep -rn "from ['\"]@/" "$SRC_DIR" 2>/dev/null || true)
if [ -n "$ALIAS_HITS" ]; then
  echo ""
  echo "FAIL: Found @/... imports (monorepo alias — use relative or package imports):"
  echo "$ALIAS_HITS"
  EXIT=1
fi

# 2. Ban deep relative imports (4+ levels)
DEEP_HITS=$(grep -rn "from ['\"]\.\.\/\.\.\/\.\.\/\.\." "$SRC_DIR" 2>/dev/null || true)
if [ -n "$DEEP_HITS" ]; then
  echo ""
  echo "FAIL: Found deep relative imports (4+ levels — restructure or use package boundary):"
  echo "$DEEP_HITS"
  EXIT=1
fi

# 3. Ban module-load-time Supabase client instantiation
#    Allowed: inside functions, factories, or behind lazy init.
#    Banned: top-level createClient() calls outside of factory files.
CLIENT_HITS=$(grep -rn "createClient\s*(" "$SRC_DIR" 2>/dev/null | grep -v "factory\|Factory\|createSupabaseClient\|// allowed" || true)
if [ -n "$CLIENT_HITS" ]; then
  echo ""
  echo "FAIL: Found createClient() outside factory pattern (use client factory + DI):"
  echo "$CLIENT_HITS"
  EXIT=1
fi

# 4. Ban direct @supabase/supabase-js imports in service code
#    Only the client factory should import this.
SUPA_HITS=$(grep -rn "from ['\"]@supabase/supabase-js['\"]" "$SRC_DIR" 2>/dev/null | grep -v "factory\|Factory\|// allowed" || true)
if [ -n "$SUPA_HITS" ]; then
  echo ""
  echo "FAIL: Found direct @supabase/supabase-js import (only client factory should import this):"
  echo "$SUPA_HITS"
  EXIT=1
fi

if [ $EXIT -eq 0 ]; then
  echo "PASS: No banned import patterns found."
fi

exit $EXIT
