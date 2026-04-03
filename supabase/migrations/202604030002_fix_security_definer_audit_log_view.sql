-- Recreate charter_audit_log as SECURITY INVOKER so it respects the querying user's RLS
DROP VIEW IF EXISTS public.charter_audit_log;

CREATE VIEW public.charter_audit_log
  WITH (security_invoker = true)
AS
SELECT
  pe.id AS event_id,
  pe.recorded_at,
  pe.event_type,
  pe.actor_id,
  pe.actor_kind,
  pe.payload_hash,
  pe.chain_hash,
  pe.metadata,
  ge.id AS entity_id,
  ge.kind AS entity_kind,
  ge.ref_code,
  ge.title AS entity_title,
  ge.status AS entity_status,
  ge.version AS entity_version
FROM charter_provenance_events pe
JOIN charter_governance_entities ge ON ge.id = pe.entity_id;

-- Grant appropriate access
GRANT SELECT ON public.charter_audit_log TO authenticated;
GRANT ALL ON public.charter_audit_log TO service_role;
