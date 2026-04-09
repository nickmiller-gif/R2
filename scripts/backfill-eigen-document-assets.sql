-- Backfill asset_registry rows for Eigen-ingested documents (domain eigen_ingest).
-- Needed for eigen-oracle-outbox-drain document-anchored signals on docs ingested before
-- eigen-ingest began auto-registering assets.
--
-- Run in Supabase SQL Editor or:
--   supabase db query --linked --file scripts/backfill-eigen-document-assets.sql
--
-- Only registers documents that already have at least one knowledge_chunk.

INSERT INTO public.asset_registry (kind, ref_id, domain, label, metadata)
SELECT
  'document'::public.asset_kind,
  d.id,
  'eigen_ingest',
  LEFT(d.title, 500),
  jsonb_build_object(
    'source_system', d.source_system,
    'backfill', true
  )
FROM public.documents d
WHERE EXISTS (
  SELECT 1 FROM public.knowledge_chunks k WHERE k.document_id = d.id
)
  AND NOT EXISTS (
    SELECT 1
    FROM public.asset_registry ar
    WHERE ar.kind = 'document'
      AND ar.ref_id = d.id
      AND ar.domain = 'eigen_ingest'
  )
ON CONFLICT (kind, ref_id, domain) DO NOTHING;
