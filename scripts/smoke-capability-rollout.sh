#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-zudslxucibosjwefojtm}"
SUPABASE_URL="${SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"
FUNCTIONS_URL="${FUNCTIONS_URL:-https://${PROJECT_REF}.functions.supabase.co}"
ANON_KEY="${SUPABASE_ANON_KEY:-}"
MEMBER_EMAIL="${MEMBER_EMAIL:-}"
MEMBER_PASSWORD="${MEMBER_PASSWORD:-}"
OPERATOR_EMAIL="${OPERATOR_EMAIL:-}"
OPERATOR_PASSWORD="${OPERATOR_PASSWORD:-}"
THESIS_ID="${THESIS_ID:-}"
EVIDENCE_ID="${EVIDENCE_ID:-}"
BLOCKED_CAPABILITY_ID="${BLOCKED_CAPABILITY_ID:-}"

need_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: ${name}" >&2
    exit 1
  fi
}

need_var "ANON_KEY"
need_var "MEMBER_EMAIL"
need_var "MEMBER_PASSWORD"
need_var "OPERATOR_EMAIL"
need_var "OPERATOR_PASSWORD"
need_var "THESIS_ID"
need_var "EVIDENCE_ID"
need_var "BLOCKED_CAPABILITY_ID"

mint_token() {
  local email="$1"
  local password="$2"
  curl -s "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))'
}

request_code() {
  local method="$1"
  local token="$2"
  local url="$3"
  local body="${4:-}"
  local idem="${5:-}"

  local -a args
  args=(-s -o /tmp/r2_smoke_body.txt -w "%{http_code}" -X "${method}" "${url}" -H "Authorization: Bearer ${token}" -H "apikey: ${ANON_KEY}")
  if [[ -n "${idem}" ]]; then
    args+=(-H "x-idempotency-key: ${idem}")
  fi
  if [[ -n "${body}" ]]; then
    args+=(-H "Content-Type: application/json" -d "${body}")
  fi
  curl "${args[@]}"
}

check_code() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "${actual}" == "${expected}" ]]; then
    echo "[PASS] ${label}: ${actual}"
  else
    echo "[FAIL] ${label}: expected ${expected}, got ${actual}" >&2
    echo "Body:" >&2
    cat /tmp/r2_smoke_body.txt >&2
    return 1
  fi
}

main() {
  local member_token operator_token
  member_token="$(mint_token "${MEMBER_EMAIL}" "${MEMBER_PASSWORD}")"
  operator_token="$(mint_token "${OPERATOR_EMAIL}" "${OPERATOR_PASSWORD}")"

  if [[ -z "${member_token}" || -z "${operator_token}" ]]; then
    echo "Failed to mint one or more JWTs." >&2
    exit 1
  fi

  local failures=0
  local code

  code="$(request_code GET "${member_token}" "${FUNCTIONS_URL}/eigen-tool-capabilities")" || true
  check_code "member eigen list" "200" "${code}" || failures=$((failures + 1))

  code="$(request_code GET "${member_token}" "${FUNCTIONS_URL}/eigen-tool-capabilities?id=${BLOCKED_CAPABILITY_ID}")" || true
  check_code "member blocked capability by id" "404" "${code}" || failures=$((failures + 1))

  code="$(request_code PATCH "${operator_token}" "${FUNCTIONS_URL}/oracle-theses" "{\"id\":\"${THESIS_ID}\",\"title\":\"Smoke Title $(date +%s)\"}" "smoke-thesis-allow-$(date +%s)")" || true
  check_code "oracle-theses allowlisted patch" "200" "${code}" || failures=$((failures + 1))

  code="$(request_code PATCH "${operator_token}" "${FUNCTIONS_URL}/oracle-theses" "{\"id\":\"${THESIS_ID}\",\"profile_id\":\"00000000-0000-0000-0000-000000000000\"}" "smoke-thesis-deny-$(date +%s)")" || true
  check_code "oracle-theses non-allowlisted patch" "400" "${code}" || failures=$((failures + 1))

  code="$(request_code PATCH "${operator_token}" "${FUNCTIONS_URL}/oracle-theses" "{\"title\":\"No id\"}" "smoke-thesis-missing-$(date +%s)")" || true
  check_code "oracle-theses missing id" "400" "${code}" || failures=$((failures + 1))

  code="$(request_code PATCH "${operator_token}" "${FUNCTIONS_URL}/oracle-evidence-items" "{\"id\":\"${EVIDENCE_ID}\",\"content_summary\":\"Smoke Summary $(date +%s)\"}" "smoke-evidence-allow-$(date +%s)")" || true
  check_code "oracle-evidence allowlisted patch" "200" "${code}" || failures=$((failures + 1))

  code="$(request_code PATCH "${operator_token}" "${FUNCTIONS_URL}/oracle-evidence-items" "{\"id\":\"${EVIDENCE_ID}\",\"profile_id\":\"00000000-0000-0000-0000-000000000000\"}" "smoke-evidence-deny-$(date +%s)")" || true
  check_code "oracle-evidence non-allowlisted patch" "400" "${code}" || failures=$((failures + 1))

  code="$(request_code PATCH "${operator_token}" "${FUNCTIONS_URL}/oracle-evidence-items" "{\"content_summary\":\"No id\"}" "smoke-evidence-missing-$(date +%s)")" || true
  check_code "oracle-evidence missing id" "400" "${code}" || failures=$((failures + 1))

  if [[ "${failures}" -gt 0 ]]; then
    echo "Smoke suite failed with ${failures} failing checks." >&2
    exit 1
  fi

  echo "Smoke suite passed."
}

main "$@"
