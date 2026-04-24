#!/usr/bin/env bash
# Single source of truth for the Supabase CLI version used across the repo.
#
# Consumed by:
#   - scripts/check-supabase-generated-types.sh
#   - scripts/check-supabase-migration-drift.sh
#   - .github/workflows/deploy.yml (Install Supabase CLI step)
#
# Keep the version aligned across these consumers — a mismatch between the
# version CI uses to generate / diff types and the version deploy uses to
# `db push` is how schema drift crept into production during April 2026.
#
# When bumping: validate `npx supabase@<new>  gen types typescript` produces
# byte-identical output to the committed `database.types.ts` before rolling
# the new version out.
set -euo pipefail

echo "2.89.0"
