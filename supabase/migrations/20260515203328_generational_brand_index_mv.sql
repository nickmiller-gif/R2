-- Generational Brand Index (Initiative 6 Phase 0): draft materialized view joining
-- charter entities with corpus-wide document aggregates and optional per-entity Atlas counts.
-- Refresh: REFRESH MATERIALIZED VIEW public.generational_brand_index; (non-concurrent Week 1)

CREATE MATERIALIZED VIEW public.generational_brand_index AS
SELECT
  ce.id AS charter_entity_id,
  ce.entity_type::text AS charter_entity_type,
  ce.name AS charter_entity_name,
  ce.metadata AS charter_metadata,
  ce.canonical_entity_id,
  (
    SELECT COALESCE(jsonb_object_agg(source_system, n), '{}'::jsonb)
    FROM (
      SELECT d.source_system, COUNT(*)::bigint AS n
      FROM public.documents d
      WHERE d.status = 'active'::document_status
      GROUP BY d.source_system
    ) s
  ) AS document_counts_by_source_system,
  (
    SELECT COUNT(*)::bigint
    FROM public.documents d
    WHERE d.status = 'active'::document_status
  ) AS documents_active_total,
  COALESCE(
    (
      SELECT COUNT(u.id)::bigint
      FROM public.atlas_urls u
      INNER JOIN public.atlas_crawls ac ON ac.id = u.crawl_id
      WHERE (ce.metadata ->> 'atlas_brand_key') IS NOT NULL
        AND ac.brand_key = (ce.metadata ->> 'atlas_brand_key')
    ),
    0::bigint
  ) AS atlas_page_count,
  (
    SELECT COALESCE(COUNT(u.id), 0)::bigint
    FROM public.atlas_urls u
  ) AS atlas_pages_portfolio_total,
  0::bigint AS persona_chunk_count_placeholder
FROM public.charter_entities ce;

CREATE UNIQUE INDEX idx_generational_brand_index_charter_entity_id
  ON public.generational_brand_index (charter_entity_id);

COMMENT ON MATERIALIZED VIEW public.generational_brand_index IS
  'Draft Brand Index: charter spine + global document histogram + Atlas counts when charter_entities.metadata.atlas_brand_key matches atlas_crawls.brand_key. Persona placeholder until persona_chunks lands.';

GRANT SELECT ON public.generational_brand_index TO authenticated;
GRANT SELECT ON public.generational_brand_index TO service_role;
