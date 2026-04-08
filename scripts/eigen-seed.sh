#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi

if [[ -z "${AUTH_BEARER:-}" ]]; then
  echo "Missing AUTH_BEARER (member JWT)"
  exit 1
fi

INGEST_URL="${INGEST_URL:-${SUPABASE_URL%/}/functions/v1/eigen-ingest}"
SOURCE_SYSTEM="${SOURCE_SYSTEM:-seed-script}"
CHUNKING_MODE="${CHUNKING_MODE:-hierarchical}"

ingest_doc() {
  local source_ref="$1"
  local title="$2"
  local body="$3"
  local policy_tag="$4"
  local idem_key="seed:${SOURCE_SYSTEM}:${source_ref}"

  local payload
  payload=$(python3 - <<'PY' "$SOURCE_SYSTEM" "$source_ref" "$title" "$body" "$policy_tag" "$CHUNKING_MODE"
import json, sys
source_system, source_ref, title, body, policy_tag, chunking_mode = sys.argv[1:]
print(json.dumps({
  "source_system": source_system,
  "source_ref": source_ref,
  "document": {
    "title": title,
    "body": body,
    "content_type": "text/plain",
    "metadata": {"seed_script": True}
  },
  "chunking_mode": chunking_mode,
  "policy_tags": [policy_tag]
}))
PY
)

  curl -sS -X POST "$INGEST_URL" \
    -H "Authorization: Bearer $AUTH_BEARER" \
    -H "Content-Type: application/json" \
    -H "x-idempotency-key: $idem_key" \
    --data "$payload"
  echo
}

echo "Seeding Eigen public and EigenX corpora..."

ingest_doc \
  "public-ray-overview" \
  "Ray Retreat Public Overview" \
  "Ray's Retreat is focused on practical AI systems, real-world execution, and transparent governance. Public updates highlight product direction and outcomes." \
  "eigen_public"

ingest_doc \
  "public-faq-grounding" \
  "Public FAQ Grounding" \
  "Public Eigen should answer only from grounded retrieved context. If context is missing, it should explicitly say it does not have enough grounded public information." \
  "eigen_public"

ingest_doc \
  "eigenx-ops-notes" \
  "EigenX Internal Ops Notes" \
  "EigenX can use broader internal knowledge with provenance, including operating procedures, adapter workflows, and quality controls for hallucination reduction." \
  "eigenx"

ingest_doc \
  "eigenx-adapter-policy" \
  "Adapter Ingestion Policy" \
  "Domain adapters should normalize records into source_system and source_ref identities, include policy tags, and send ingestion through R2 edge functions." \
  "eigenx"

echo "Seed complete."
