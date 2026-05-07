-- R2Chart Continuity — Phase B.2 hotfix: recreate Evidence Integrity Rail view
-- Postgres rejects CREATE OR REPLACE VIEW when column order/names change vs Phase A.
-- See migration 20260508180000 (view definition moved here).

DROP VIEW IF EXISTS public.v_evidence_integrity_rail CASCADE;

CREATE VIEW public.v_evidence_integrity_rail
WITH (security_invoker = true) AS
SELECT
  el.id,
  el.workspace_id,
  el.context_asset_id,
  ca.display_code AS asset_display_code,
  el.claim_id,
  gc.statement AS governed_claim_statement,
  gc.status AS governed_claim_status,
  el.evidence_source_id,
  es.display_label AS evidence_source_label,
  el.missing_proof_item,
  el.provenance_status,
  el.contradiction_state,
  el.freshness_band,
  el.source_authority,
  el.review_posture,
  el.evidence_summary,
  el.created_at
FROM public.continuity_evidence_links el
LEFT JOIN public.continuity_context_assets ca ON ca.id = el.context_asset_id
LEFT JOIN public.continuity_claims gc ON gc.id = el.claim_id
LEFT JOIN public.continuity_evidence_sources es ON es.id = el.evidence_source_id
WHERE el.missing_proof_item IS NOT NULL
   OR el.review_posture IN ('human_gated', 'blocked');

GRANT SELECT ON public.v_evidence_integrity_rail TO authenticated;
GRANT SELECT ON public.v_evidence_integrity_rail TO anon;
GRANT ALL ON public.v_evidence_integrity_rail TO service_role;
