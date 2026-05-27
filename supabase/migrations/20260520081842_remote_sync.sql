
CREATE SCHEMA IF NOT EXISTS works;

CREATE OR REPLACE FUNCTION public.operator_allows_scope(_uid uuid, _scope text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, works
AS $$
  SELECT EXISTS (
    SELECT 1 FROM works.operator_profiles op
    WHERE op.user_id = _uid
      AND op.active = true
      AND (op.role::text = 'both' OR _scope = 'both' OR op.role::text = _scope)
  )
$$;

CREATE TABLE IF NOT EXISTS works.legislation_tools (
  slug text PRIMARY KEY,
  name text NOT NULL,
  tagline text,
  description text,
  tool_kind text NOT NULL CHECK (tool_kind IN ('ingest','resolve')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','coming-soon','disabled')),
  governance_scope text NOT NULL DEFAULT 'commercial' CHECK (governance_scope IN ('foundation','commercial','both')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE works.legislation_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_tools_read ON works.legislation_tools;
CREATE POLICY leg_tools_read ON works.legislation_tools FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_concepts (
  id text PRIMARY KEY,
  label text NOT NULL,
  definition text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('actor','subject','obligation','trigger','lifecycle')),
  parent_id text REFERENCES works.legislation_concepts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE works.legislation_concepts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_concepts_read ON works.legislation_concepts;
CREATE POLICY leg_concepts_read ON works.legislation_concepts FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_concept_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id text NOT NULL REFERENCES works.legislation_concepts(id) ON DELETE CASCADE,
  alias_text text NOT NULL,
  jurisdiction text,
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, alias_text, jurisdiction)
);
ALTER TABLE works.legislation_concept_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_concept_aliases_read ON works.legislation_concept_aliases;
CREATE POLICY leg_concept_aliases_read ON works.legislation_concept_aliases FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_identifier text NOT NULL,
  payload jsonb,
  payload_hash text NOT NULL,
  ingest_run_id uuid,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_identifier, payload_hash)
);
ALTER TABLE works.legislation_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_sources_read ON works.legislation_sources;
CREATE POLICY leg_sources_read ON works.legislation_sources FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES works.legislation_sources(id) ON DELETE SET NULL,
  jurisdiction text NOT NULL,
  identifier text NOT NULL,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'statute',
  lifecycle_state text NOT NULL DEFAULT 'introduced',
  introduced_at date,
  passed_chamber_at date,
  signed_at date,
  effective_at date,
  superseded_at date,
  version_chain_root uuid,
  version_number int NOT NULL DEFAULT 1,
  full_text text,
  full_text_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, identifier, version_number)
);
CREATE INDEX IF NOT EXISTS leg_docs_jurisdiction_idx ON works.legislation_documents(jurisdiction);
CREATE INDEX IF NOT EXISTS leg_docs_identifier_idx ON works.legislation_documents(identifier);
ALTER TABLE works.legislation_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_docs_read ON works.legislation_documents;
CREATE POLICY leg_docs_read ON works.legislation_documents FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES works.legislation_documents(id) ON DELETE CASCADE,
  section_path text NOT NULL,
  text text NOT NULL,
  provision_order int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leg_prov_doc_idx ON works.legislation_provisions(document_id, provision_order);
ALTER TABLE works.legislation_provisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_prov_read ON works.legislation_provisions;
CREATE POLICY leg_prov_read ON works.legislation_provisions FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_obligation_atoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_id uuid NOT NULL REFERENCES works.legislation_provisions(id) ON DELETE CASCADE,
  actor_concept_id text REFERENCES works.legislation_concepts(id),
  action_concept_id text REFERENCES works.legislation_concepts(id),
  trigger_jsonb jsonb,
  threshold_jsonb jsonb,
  exception_jsonb jsonb,
  consequence_jsonb jsonb,
  effective_date date,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leg_atoms_action_idx ON works.legislation_obligation_atoms(action_concept_id);
CREATE INDEX IF NOT EXISTS leg_atoms_actor_idx ON works.legislation_obligation_atoms(actor_concept_id);
ALTER TABLE works.legislation_obligation_atoms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_atoms_read ON works.legislation_obligation_atoms;
CREATE POLICY leg_atoms_read ON works.legislation_obligation_atoms FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_atom_concepts (
  atom_id uuid NOT NULL REFERENCES works.legislation_obligation_atoms(id) ON DELETE CASCADE,
  concept_id text NOT NULL REFERENCES works.legislation_concepts(id),
  role text NOT NULL CHECK (role IN ('actor','action','subject','trigger','exception')),
  PRIMARY KEY (atom_id, concept_id, role)
);
ALTER TABLE works.legislation_atom_concepts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_atom_concepts_read ON works.legislation_atom_concepts;
CREATE POLICY leg_atom_concepts_read ON works.legislation_atom_concepts FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_concept_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_label text NOT NULL,
  proposed_kind text NOT NULL,
  proposed_aliases text[] NOT NULL DEFAULT '{}',
  rationale text,
  source_atom_id uuid REFERENCES works.legislation_obligation_atoms(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE works.legislation_concept_review_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_review_read ON works.legislation_concept_review_queue;
CREATE POLICY leg_review_read ON works.legislation_concept_review_queue FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL,
  source_system text NOT NULL,
  jurisdiction text NOT NULL,
  bill_filter text,
  since date,
  manual_payload jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  documents_new int NOT NULL DEFAULT 0,
  documents_updated int NOT NULL DEFAULT 0,
  error_message text,
  latency_ms int,
  started_at timestamptz,
  completed_at timestamptz,
  governance_scope text NOT NULL DEFAULT 'commercial' CHECK (governance_scope IN ('foundation','commercial','both')),
  discovery_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leg_ingest_runs_created_idx ON works.legislation_ingest_runs(created_at DESC);
ALTER TABLE works.legislation_ingest_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_ingest_runs_read ON works.legislation_ingest_runs;
CREATE POLICY leg_ingest_runs_read ON works.legislation_ingest_runs FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()) AND public.operator_allows_scope(auth.uid(), governance_scope));
DROP POLICY IF EXISTS leg_ingest_runs_insert ON works.legislation_ingest_runs;
CREATE POLICY leg_ingest_runs_insert ON works.legislation_ingest_runs FOR INSERT TO authenticated
  WITH CHECK (operator_user_id = auth.uid()
    AND public.is_active_operator(auth.uid())
    AND public.operator_allows_scope(auth.uid(), governance_scope));

CREATE TABLE IF NOT EXISTS works.legislation_resolution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('conflict','normalize','project')),
  jurisdictions text[] NOT NULL DEFAULT '{}',
  actor_role text,
  subject_types text[],
  concept_id text REFERENCES works.legislation_concepts(id),
  query_json jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  error_message text,
  latency_ms int,
  started_at timestamptz,
  completed_at timestamptz,
  governance_scope text NOT NULL DEFAULT 'commercial' CHECK (governance_scope IN ('foundation','commercial','both')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leg_res_runs_created_idx ON works.legislation_resolution_runs(created_at DESC);
ALTER TABLE works.legislation_resolution_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_res_runs_read ON works.legislation_resolution_runs;
CREATE POLICY leg_res_runs_read ON works.legislation_resolution_runs FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()) AND public.operator_allows_scope(auth.uid(), governance_scope));
DROP POLICY IF EXISTS leg_res_runs_insert ON works.legislation_resolution_runs;
CREATE POLICY leg_res_runs_insert ON works.legislation_resolution_runs FOR INSERT TO authenticated
  WITH CHECK (operator_user_id = auth.uid()
    AND public.is_active_operator(auth.uid())
    AND public.operator_allows_scope(auth.uid(), governance_scope));

CREATE TABLE IF NOT EXISTS works.legislation_run_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingest_run_id uuid REFERENCES works.legislation_ingest_runs(id) ON DELETE CASCADE,
  resolution_run_id uuid REFERENCES works.legislation_resolution_runs(id) ON DELETE CASCADE,
  section text NOT NULL,
  content_markdown text,
  content_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leg_outputs_ingest_idx ON works.legislation_run_outputs(ingest_run_id);
CREATE INDEX IF NOT EXISTS leg_outputs_res_idx ON works.legislation_run_outputs(resolution_run_id);
ALTER TABLE works.legislation_run_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_outputs_read ON works.legislation_run_outputs;
CREATE POLICY leg_outputs_read ON works.legislation_run_outputs FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE TABLE IF NOT EXISTS works.legislation_discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL,
  source_system text NOT NULL,
  jurisdiction text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  since date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  discovered_count int NOT NULL DEFAULT 0,
  ingested_count int NOT NULL DEFAULT 0,
  atoms_extracted int NOT NULL DEFAULT 0,
  error_message text,
  latency_ms int,
  started_at timestamptz,
  completed_at timestamptz,
  governance_scope text NOT NULL DEFAULT 'commercial' CHECK (governance_scope IN ('foundation','commercial','both')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leg_discovery_created_idx ON works.legislation_discovery_jobs(created_at DESC);
ALTER TABLE works.legislation_discovery_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leg_discovery_read ON works.legislation_discovery_jobs;
CREATE POLICY leg_discovery_read ON works.legislation_discovery_jobs FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()) AND public.operator_allows_scope(auth.uid(), governance_scope));
DROP POLICY IF EXISTS leg_discovery_insert ON works.legislation_discovery_jobs;
CREATE POLICY leg_discovery_insert ON works.legislation_discovery_jobs FOR INSERT TO authenticated
  WITH CHECK (operator_user_id = auth.uid()
    AND public.is_active_operator(auth.uid())
    AND public.operator_allows_scope(auth.uid(), governance_scope));

-- Seed tools
INSERT INTO works.legislation_tools (slug, name, tagline, description, tool_kind, status, governance_scope, sort_order) VALUES
  ('legislation-ingest','Corpus Ingest','Fetch AI legislation from a jurisdiction into the structured corpus','Discover, fetch, and atomize AI legislation. Auto-discovery via Congress.gov is wired; manual_upload remains available.','ingest','active','commercial',10),
  ('legislation-resolve','Cross-Jurisdiction Resolution','Conflict detection · concept normalization · compliance projection','Query the corpus for cross-jurisdictional conflicts, jurisdictional variants of a canonical concept, or the obligations that apply to a use case.','resolve','active','commercial',20)
ON CONFLICT (slug) DO UPDATE SET status=EXCLUDED.status, name=EXCLUDED.name, tagline=EXCLUDED.tagline, description=EXCLUDED.description;

-- Seed canonical concepts
INSERT INTO works.legislation_concepts (id, label, definition, kind) VALUES
  ('concept:actor.developer','Developer','Entity that designs, codes, or trains an AI system before it is placed on the market or put into service.','actor'),
  ('concept:actor.provider','Provider','Entity that develops or has developed an AI system and places it on the market or puts it into service under its own name or trademark.','actor'),
  ('concept:actor.deployer','Deployer','Entity using an AI system under its authority, except for personal non-professional activity.','actor'),
  ('concept:actor.distributor','Distributor','Entity in the supply chain, other than the provider or importer, that makes an AI system available on the market.','actor'),
  ('concept:actor.importer','Importer','Entity located or established in a jurisdiction that places on the market an AI system from a third country.','actor'),
  ('concept:actor.affected_individual','Affected individual','Natural person to whom an AI system''s output is applied or who is the subject of an automated decision.','actor'),
  ('concept:subject.general_purpose_model','General-purpose AI model','AI model trained on broad data at scale, capable of competently performing a wide range of distinct tasks.','subject'),
  ('concept:subject.foundation_model','Foundation model','Large-scale model trained on broad data that can be adapted to a wide range of downstream tasks.','subject'),
  ('concept:subject.automated_decision_system','Automated decision system (ADM)','Computational process used to make a decision or assist in making a decision about a person.','subject'),
  ('concept:subject.generative_system','Generative AI system','AI system primarily intended to generate synthetic text, images, audio, or video.','subject'),
  ('concept:subject.biometric_system','Biometric AI system','AI system that recognizes, categorizes, or infers attributes from biometric data.','subject'),
  ('concept:subject.emotion_recognition','Emotion recognition system','AI system designed to identify or infer emotions or intentions of natural persons based on biometric data.','subject'),
  ('concept:subject.content_moderation','Content moderation system','AI system that classifies, labels, or removes user-generated content on a platform.','subject'),
  ('concept:subject.deepfake_synthetic_media','Deepfake / synthetic media','Audio, image, or video content that has been generated or manipulated by AI to appear authentic.','subject'),
  ('concept:subject.training_data','Training data','Data used to train, validate, or test an AI system.','subject'),
  ('concept:obligation.impact_assessment','Impact assessment','Documented evaluation of the foreseeable risks and impacts of an AI system before deployment.','obligation'),
  ('concept:obligation.bias_audit','Bias audit','Independent or self-administered audit of an AI system for disparate impact across protected classes.','obligation'),
  ('concept:obligation.technical_documentation','Technical documentation','Maintained technical documentation describing system design, training data, and capabilities.','obligation'),
  ('concept:obligation.transparency_to_user','Transparency to user','Disclosure to the user that they are interacting with or being evaluated by an AI system.','obligation'),
  ('concept:obligation.transparency_to_regulator','Transparency to regulator','Disclosure to a competent authority of system characteristics, deployments, or incidents.','obligation'),
  ('concept:obligation.notification','Notification','Pre- or post-decision notice to affected individuals that an AI system was used.','obligation'),
  ('concept:obligation.registration','Registration','Registration of an AI system with a public or regulatory registry before deployment.','obligation'),
  ('concept:obligation.human_oversight','Human oversight','Requirement that a human can intervene in, override, or review the operation of an AI system.','obligation'),
  ('concept:obligation.opt_out_right','Opt-out right','Right of an affected individual to opt out of fully or partially automated decision-making.','obligation'),
  ('concept:obligation.right_to_explanation','Right to explanation','Right of an affected individual to receive an explanation of how an AI system reached a decision about them.','obligation'),
  ('concept:obligation.watermarking_provenance','Watermarking / provenance','Technical marking of AI-generated content to indicate its synthetic origin.','obligation'),
  ('concept:obligation.incident_reporting','Incident reporting','Reporting of serious AI-related incidents or malfunctions to a competent authority.','obligation'),
  ('concept:trigger.territorial_nexus','Territorial nexus','Application of the rule turns on the AI system''s availability or use within a jurisdiction.','trigger'),
  ('concept:trigger.residency_affected_person','Residency of affected person','Application of the rule turns on the residency of the natural person affected by the AI system.','trigger'),
  ('concept:trigger.risk_classification','Risk classification','Application of the rule turns on a classification of the AI system''s risk tier.','trigger'),
  ('concept:trigger.sectoral_application','Sectoral application','Application of the rule turns on the sector in which the AI system is used.','trigger')
ON CONFLICT (id) DO NOTHING;

INSERT INTO works.legislation_concepts (id, label, definition, kind, parent_id) VALUES
  ('concept:subject.aedt','Automated employment decision tool','Computational process derived from AI used to substantially assist or replace discretionary employment decisions.','subject','concept:subject.automated_decision_system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO works.legislation_concept_aliases (concept_id, alias_text, jurisdiction, source_note) VALUES
  ('concept:subject.automated_decision_system','consequential decision system','us-co','Colorado AI Act SB 24-205'),
  ('concept:subject.automated_decision_system','automated decision system','us-ca','CA AB 331'),
  ('concept:subject.automated_decision_system','automated decisionmaking system','us-ca','CCPA ADMT regulations'),
  ('concept:subject.aedt','AEDT','us-nyc','NYC Local Law 144'),
  ('concept:subject.aedt','automated employment decision tool','us-nyc','NYC Local Law 144'),
  ('concept:subject.generative_system','covered generative AI system','us-ca','CA AB 2013'),
  ('concept:subject.deepfake_synthetic_media','synthetic media','us-federal','Multiple federal proposals'),
  ('concept:subject.deepfake_synthetic_media','deepfake','us-federal','Multiple federal proposals'),
  ('concept:subject.foundation_model','general-purpose AI model','eu','EU AI Act Title VIIIA'),
  ('concept:subject.foundation_model','GPAI model','eu','EU AI Act Title VIIIA'),
  ('concept:obligation.bias_audit','bias audit','us-nyc','NYC Local Law 144'),
  ('concept:obligation.bias_audit','algorithmic impact assessment','us-co','Colorado AI Act'),
  ('concept:obligation.impact_assessment','algorithmic impact assessment','us-co','Colorado AI Act'),
  ('concept:obligation.impact_assessment','fundamental rights impact assessment','eu','EU AI Act Art. 27'),
  ('concept:obligation.transparency_to_user','notice of use','us-co','Colorado AI Act'),
  ('concept:obligation.transparency_to_user','transparency obligation','eu','EU AI Act Art. 50'),
  ('concept:obligation.watermarking_provenance','content provenance','us-ca','CA SB 942'),
  ('concept:obligation.right_to_explanation','meaningful explanation','us-co','Colorado AI Act'),
  ('concept:trigger.risk_classification','high-risk AI system','eu','EU AI Act Annex III'),
  ('concept:trigger.risk_classification','high-risk system','us-co','Colorado AI Act')
ON CONFLICT (concept_id, alias_text, jurisdiction) DO NOTHING;

GRANT USAGE ON SCHEMA works TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA works TO authenticated;
GRANT INSERT ON works.legislation_ingest_runs,
                works.legislation_resolution_runs,
                works.legislation_discovery_jobs
            TO authenticated;
;
