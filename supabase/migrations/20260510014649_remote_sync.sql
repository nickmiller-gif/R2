
-- ── Base tables ─────────────────────────────────────────────
CREATE TABLE public.idea_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  idea TEXT NOT NULL,
  problem TEXT NOT NULL,
  target_customer TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'idea',
  existing_solutions TEXT,
  additional_context TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.researchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  interviews_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.validation_batches (
  id TEXT NOT NULL PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.idea_submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted',
  researcher_id UUID REFERENCES public.researchers(id) ON DELETE SET NULL,
  interviews_target INTEGER NOT NULL DEFAULT 5,
  interviews_completed INTEGER NOT NULL DEFAULT 0,
  sla_deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_validation_batches_submission ON public.validation_batches(submission_id);

CREATE TABLE public.batch_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES public.validation_batches(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batch_steps_batch ON public.batch_steps(batch_id);

CREATE TABLE public.batch_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES public.validation_batches(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batch_messages_batch ON public.batch_messages(batch_id);

CREATE TABLE public.validation_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES public.validation_batches(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'PIVOT',
  summary TEXT NOT NULL DEFAULT '',
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  interviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  researcher_name TEXT,
  researcher_title TEXT,
  agent_run_id UUID,
  tier TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  supported_claim_pct NUMERIC,
  model_agreement_pct NUMERIC,
  review_status TEXT NOT NULL DEFAULT 'draft',
  reviewer_id UUID,
  published_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_validation_reports_batch ON public.validation_reports(batch_id);
CREATE INDEX idx_validation_reports_review_status ON public.validation_reports(review_status);

-- ── Agent pipeline tables ───────────────────────────────────
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES public.validation_batches(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'pending',
  current_stage TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC NOT NULL DEFAULT 0,
  budget_usd NUMERIC NOT NULL DEFAULT 1.5,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_runs_batch ON public.agent_runs(batch_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);

CREATE TABLE public.agent_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  tool_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  duration_ms INTEGER,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  error TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_steps_run ON public.agent_steps(run_id, sort_order);

CREATE TABLE public.agent_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT,
  excerpt TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'web',
  relevance_score NUMERIC,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_evidence_run ON public.agent_evidence(run_id);

CREATE TABLE public.synthetic_interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  participant_label TEXT NOT NULL,
  participant_profile TEXT NOT NULL,
  takeaway TEXT NOT NULL,
  severity_rating INTEGER NOT NULL DEFAULT 5,
  willingness_to_pay TEXT,
  alternatives_mentioned TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  key_quotes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  evidence_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  interview_source TEXT NOT NULL DEFAULT 'synthetic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_synthetic_interviews_run ON public.synthetic_interviews(run_id);

CREATE TABLE public.model_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  verdict TEXT,
  score NUMERIC,
  themes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  blind_spots TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  dissent_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_risk TEXT,
  top_opportunity TEXT,
  raw_response JSONB,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_reviews_run ON public.model_reviews(run_id);

CREATE TABLE public.claim_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_path TEXT,
  evidence_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  deterministic_pass BOOLEAN NOT NULL DEFAULT false,
  verifier_verdict TEXT,
  verifier_reasoning TEXT,
  verifier_model TEXT,
  final_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_claim_checks_run ON public.claim_checks(run_id);

CREATE TABLE public.review_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.validation_reports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  decision TEXT NOT NULL,
  notes TEXT,
  edits JSONB,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_decisions_report ON public.review_decisions(report_id);

CREATE TABLE public.agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.validation_reports(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  parts JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_messages_report ON public.agent_messages(report_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.idea_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_steps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researchers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_steps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_evidence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_checks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_decisions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages       ENABLE ROW LEVEL SECURITY;

-- Public submission flow (no auth required)
CREATE POLICY "anon insert submissions"   ON public.idea_submissions   FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon read submissions"     ON public.idea_submissions   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon insert batches"       ON public.validation_batches FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon read batches"         ON public.validation_batches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon insert batch steps"   ON public.batch_steps        FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon read batch steps"     ON public.batch_steps        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon update batch steps"   ON public.batch_steps        FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "anon insert batch msgs"    ON public.batch_messages     FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon read batch msgs"      ON public.batch_messages     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read reports"         ON public.validation_reports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read researchers"     ON public.researchers        FOR SELECT TO anon, authenticated USING (true);

-- Agent internals: read for everyone (live status page), writes via service role
CREATE POLICY "anon read agent runs"      ON public.agent_runs         FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read agent steps"     ON public.agent_steps        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read agent evidence"  ON public.agent_evidence     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read synth interviews" ON public.synthetic_interviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read model reviews"   ON public.model_reviews      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read claim checks"    ON public.claim_checks       FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon read agent messages"  ON public.agent_messages     FOR SELECT TO anon, authenticated USING (true);

-- Reviewers / admins
CREATE POLICY "reviewers insert decisions" ON public.review_decisions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'reviewer'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "reviewers read decisions"   ON public.review_decisions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'reviewer'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "reviewers update reports"   ON public.validation_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'reviewer'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));
;
