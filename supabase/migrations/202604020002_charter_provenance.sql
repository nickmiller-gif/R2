-- Charter Slice 01: Provenance Table
-- Migration: 202604020002

CREATE TABLE charter_provenance_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES charter_governance_entities(id),
  event_type      TEXT        NOT NULL,
  actor_id        UUID        NOT NULL,
  actor_kind      TEXT        NOT NULL DEFAULT 'user',
  payload_hash    TEXT        NOT NULL,
  chain_hash      TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prov_events_entity     ON charter_provenance_events(entity_id);
CREATE INDEX idx_prov_events_actor      ON charter_provenance_events(actor_id);
CREATE INDEX idx_prov_events_recorded   ON charter_provenance_events(recorded_at);
CREATE INDEX idx_prov_events_event_type ON charter_provenance_events(event_type);

-- Immutable append: no updates or deletes on provenance
CREATE RULE no_update_provenance AS
  ON UPDATE TO charter_provenance_events DO INSTEAD NOTHING;

CREATE RULE no_delete_provenance AS
  ON DELETE TO charter_provenance_events DO INSTEAD NOTHING;

ALTER TABLE charter_provenance_events ENABLE ROW LEVEL SECURITY;
