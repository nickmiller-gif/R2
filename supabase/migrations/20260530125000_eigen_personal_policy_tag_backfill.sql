-- Backfill personal EigenX policy tags for member-upload documents ingested before
-- eigen-ingest began tagging chunks with eigenx:user:<owner_id>.
--
-- Safe to re-run: only appends missing personal tags; does not remove eigenx org tag.

UPDATE public.knowledge_chunks k
SET policy_tags = k.policy_tags || to_jsonb(ARRAY['eigenx:user:' || d.owner_id::text])
FROM public.documents d
WHERE k.document_id = d.id
  AND d.owner_id IS NOT NULL
  AND (
    lower(d.source_system) LIKE '%upload%'
    OR lower(d.source_system) LIKE '%manual%'
    OR lower(d.source_system) LIKE '%autonomous%'
  )
  AND NOT (
    k.policy_tags @> to_jsonb(ARRAY['eigenx:user:' || d.owner_id::text])
  );

COMMENT ON TABLE public.knowledge_chunks IS
  'Eigen knowledge chunks; policy_tags include eigenx:user:<id> and eigenx:group:<id> for scoped retrieval.';
