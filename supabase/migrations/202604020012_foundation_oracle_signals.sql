-- Phase 0: Oracle signals table — scored intelligence assessments.
-- Oracle reads evidence and produces signals with explicit scoring,
-- confidence, and reason traces.

CREATE TYPE signal_status AS ENUM ('pending', 'scored', 'expired', 'superseded');
CREATE TYPE confidence_band AS ENUM ('high', 'medium', 'low');

CREATE TABLE oracle_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this signal scores (references asset_registry.id)
  entity_asset_id uuid NOT NULL,

  -- Scoring
  score smallint NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence confidence_band NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  status signal_status NOT NULL DEFAULT 'scored',

  -- Evidence links
  analysis_document_id uuid REFERENCES documents(id),
  source_asset_id uuid,

  -- Producer metadata
  producer_ref text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  scored_at timestamptz NOT NULL DEFAULT now(),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_oracle_signals_entity ON oracle_signals (entity_asset_id);
CREATE INDEX idx_oracle_signals_status ON oracle_signals (status);
CREATE INDEX idx_oracle_signals_confidence ON oracle_signals (confidence);
CREATE INDEX idx_oracle_signals_score ON oracle_signals (score);
CREATE INDEX idx_oracle_signals_scored_at ON oracle_signals (scored_at DESC);
CREATE INDEX idx_oracle_signals_producer ON oracle_signals (producer_ref);
CREATE INDEX idx_oracle_signals_tags ON oracle_signals USING GIN (tags);

-- RLS
ALTER TABLE oracle_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY oracle_signals_read ON oracle_signals
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY oracle_signals_write ON oracle_signals
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE oracle_signals IS
  'Oracle intelligence assessments — scored signals with confidence bands and evidence traces.';
