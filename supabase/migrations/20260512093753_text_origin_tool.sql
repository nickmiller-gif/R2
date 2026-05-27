-- Text origin tool: public reference profiles (read-only for anon) + feedback rows (service-role only).

CREATE TABLE public.text_origin_reference_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family, version)
);

ALTER TABLE public.text_origin_reference_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "text_origin_profiles_select_public"
  ON public.text_origin_reference_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.text_origin_reference_profiles (family, version, stats) VALUES
  ('google', 1, '{"vec":[0.42,0.32,0.18,0.38,0.35]}'::jsonb),
  ('openai', 1, '{"vec":[0.48,0.36,0.12,0.28,0.4]}'::jsonb),
  ('anthropic', 1, '{"vec":[0.44,0.34,0.14,0.22,0.38]}'::jsonb)
ON CONFLICT (family, version) DO NOTHING;

COMMENT ON TABLE public.text_origin_reference_profiles IS
  'Versioned stylometric reference vectors for soft family similarity (non-forensic).';

CREATE TABLE public.text_origin_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score_run_id UUID,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  text_sha256 TEXT NOT NULL,
  length_bucket INTEGER NOT NULL,
  helpful TEXT,
  user_label TEXT,
  source TEXT NOT NULL DEFAULT 'text_origin_tool',
  retention_purge_after TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  CONSTRAINT text_origin_feedback_helpful_chk CHECK (helpful IS NULL OR helpful IN ('yes', 'no')),
  CONSTRAINT text_origin_feedback_label_chk CHECK (user_label IS NULL OR user_label IN ('human', 'ai', 'unclear'))
);

ALTER TABLE public.text_origin_feedback ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.text_origin_feedback IS
  'Explicit user feedback on text-origin scores; purge after retention_purge_after (default 90d). No raw text stored.';

COMMENT ON COLUMN public.text_origin_feedback.text_sha256 IS
  'SHA-256 hex of analyzed text from client; not reversible to full text without brute force.';;
