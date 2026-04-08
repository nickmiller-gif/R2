#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "Missing SUPABASE_URL"
  exit 1
fi

OWNER_ID="${OWNER_ID:-50429563-07e6-4dda-b397-a25333b7680f}"
SOURCE_SYSTEM="${SOURCE_SYSTEM:-seed-sql}"

if [[ ! "$OWNER_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "OWNER_ID must be a UUID"
  exit 1
fi

if [[ ! "$SOURCE_SYSTEM" =~ ^[a-zA-Z0-9._:-]+$ ]]; then
  echo "SOURCE_SYSTEM contains unsupported characters"
  exit 1
fi

TMP_SQL="$(mktemp)"
trap 'rm -f "$TMP_SQL"' EXIT

cat >"$TMP_SQL" <<SQL
DO \$\$
DECLARE
  v_owner_id uuid := '${OWNER_ID}'::uuid;
  v_source_system text := '${SOURCE_SYSTEM}';
  v_embed extensions.vector(1536) := (array_fill(0.001::double precision, array[1536]))::extensions.vector(1536);
BEGIN
  DELETE FROM public.documents d
  WHERE d.source_system = v_source_system
    AND d.source_ref IN (
      'public-ray-overview',
      'public-faq-grounding',
      'eigenx-ops-notes',
      'eigenx-adapter-policy'
    );

  INSERT INTO public.documents (
    source_system, source_ref, owner_id, title, body, content_type, status,
    content_hash, index_status, embedding_status, extracted_text_status, updated_at
  )
  VALUES
    (
      v_source_system, 'public-ray-overview', v_owner_id,
      'Ray Retreat Public Overview',
      'Rays Retreat focuses on practical AI systems, real-world execution, and transparent governance.',
      'text/plain', 'active', md5('public-ray-overview'),
      'indexed', 'embedded', 'extracted', now()
    ),
    (
      v_source_system, 'public-faq-grounding', v_owner_id,
      'Public FAQ Grounding',
      'Public Eigen answers only from grounded retrieved context and should refuse to speculate when context is missing.',
      'text/plain', 'active', md5('public-faq-grounding'),
      'indexed', 'embedded', 'extracted', now()
    ),
    (
      v_source_system, 'eigenx-ops-notes', v_owner_id,
      'EigenX Internal Ops Notes',
      'EigenX uses internal knowledge with provenance, adapter workflows, and controls for reducing hallucinations.',
      'text/plain', 'active', md5('eigenx-ops-notes'),
      'indexed', 'embedded', 'extracted', now()
    ),
    (
      v_source_system, 'eigenx-adapter-policy', v_owner_id,
      'Adapter Ingestion Policy',
      'Domain adapters should normalize records into source_system/source_ref identities and route ingestion through R2 edge functions.',
      'text/plain', 'active', md5('eigenx-adapter-policy'),
      'indexed', 'embedded', 'extracted', now()
    );

  INSERT INTO public.knowledge_chunks (
    document_id, chunk_level, heading_path, entity_ids, policy_tags,
    authority_score, freshness_score, provenance_completeness, content,
    content_hash, embedding_version, embedding
  )
  SELECT
    d.id,
    'document'::public.chunk_level,
    to_jsonb(ARRAY[d.title]),
    '[]'::jsonb,
    CASE
      WHEN d.source_ref LIKE 'public-%' THEN '["eigen_public"]'::jsonb
      ELSE '["eigenx"]'::jsonb
    END,
    70,
    100,
    100,
    d.body,
    md5(d.body),
    'seed-sql',
    v_embed
  FROM public.documents d
  WHERE d.source_system = v_source_system
    AND d.source_ref IN (
      'public-ray-overview',
      'public-faq-grounding',
      'eigenx-ops-notes',
      'eigenx-adapter-policy'
    );
END \$\$;
SQL

supabase db query --linked --file "$TMP_SQL"

echo "Seeded public and eigenx corpora via SQL for source_system=${SOURCE_SYSTEM} owner_id=${OWNER_ID}"
