#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/eigen-eval.py"
