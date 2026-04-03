-- Oracle opportunities table
-- First-class persistence for ranked opportunities derived from theses.

CREATE TABLE IF NOT EXISTS oracle_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thesis_id uuid NOT NULL REFERENCES oracle_theses(id) ON DELETE CASCADE,

  title text NOT NULL,
  buyer text NOT NULL,
  offer text NOT NULL,
  pricing_model text NOT NULL,
  estimated_acv_or_ltv numeric,
  channel text NOT NULL,
  time_to_first_revenue text NOT NULL,
  proof_required text NOT NULL,

  evidence_support_score numeric NOT NULL DEFAULT 0,
  confidence_thesis numeric NOT NULL DEFAULT 0,
  confidence_economics numeric NOT NULL DEFAULT 0,
  confidence_timing numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  linked_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT oracle_opportunities_status_check CHECK (
    status IN ('candidate', 'watchlist', 'validated', 'rejected', 'archived')
  ),
  CONSTRAINT oracle_opportunities_unique_profile_thesis_title UNIQUE (profile_id, thesis_id, title)
);

CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_profile_id ON oracle_opportunities(profile_id);
CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_thesis_id ON oracle_opportunities(thesis_id);
CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_status ON oracle_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_created_at ON oracle_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_opportunities_linked_evidence_ids ON oracle_opportunities USING GIN (linked_evidence_ids);

ALTER TABLE oracle_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_oracle_opportunities ON oracle_opportunities
  FOR SELECT
  USING (auth.role() = 'authenticated' AND profile_id = auth.uid());

CREATE POLICY insert_oracle_opportunities ON oracle_opportunities
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY update_oracle_opportunities ON oracle_opportunities
  FOR UPDATE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR profile_id = auth.uid());

CREATE POLICY delete_oracle_opportunities ON oracle_opportunities
  FOR DELETE
  USING (auth.role() = 'service_role' OR profile_id = auth.uid());
