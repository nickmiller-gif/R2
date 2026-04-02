-- Charter Slice 01: Audit Read Path (views, indexes, RLS)
-- Migration: 202604020003

-- Denormalized audit read view joining governance entities with provenance
CREATE VIEW charter_audit_log AS
SELECT
  pe.id                   AS event_id,
  pe.recorded_at,
  pe.event_type,
  pe.actor_id,
  pe.actor_kind,
  pe.payload_hash,
  pe.chain_hash,
  pe.metadata,
  ge.id                   AS entity_id,
  ge.kind                 AS entity_kind,
  ge.ref_code,
  ge.title                AS entity_title,
  ge.status               AS entity_status,
  ge.version              AS entity_version
FROM
  charter_provenance_events pe
  JOIN charter_governance_entities ge ON ge.id = pe.entity_id;

-- RLS policy: audit log is read-only, accessible to authenticated users
-- Write access is handled by service layer only
CREATE POLICY audit_log_read
  ON charter_provenance_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Governance entity read policy
CREATE POLICY governance_entity_read
  ON charter_governance_entities
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Governance entity write (insert/update) restricted to service role
CREATE POLICY governance_entity_write
  ON charter_governance_entities
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY governance_transition_read
  ON charter_governance_transitions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY governance_transition_write
  ON charter_governance_transitions
  FOR ALL
  USING (auth.role() = 'service_role');
