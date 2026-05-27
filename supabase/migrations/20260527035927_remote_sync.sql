-- Phase 3 Slice 5: agent run artifacts + signed verifier surface

CREATE TABLE IF NOT EXISTS public.agent_run_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  output_section text NOT NULL,
  format text NOT NULL CHECK (format IN ('pdf','ics','eml','docx','xlsx','jsonld','csv','txt')),
  storage_path text NOT NULL,
  content_sha256 text NOT NULL,
  signature text NOT NULL,
  signing_key_id text NOT NULL,
  provenance_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_artifacts_run ON public.agent_run_artifacts(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_run_artifacts_sha ON public.agent_run_artifacts(content_sha256);

GRANT SELECT ON public.agent_run_artifacts TO authenticated;
GRANT ALL ON public.agent_run_artifacts TO service_role;

ALTER TABLE public.agent_run_artifacts ENABLE ROW LEVEL SECURITY;

-- Operators can read metadata for any artifact they generated.
CREATE POLICY "Operators read own artifacts"
  ON public.agent_run_artifacts FOR SELECT
  TO authenticated
  USING (generated_by = auth.uid());

-- Security-definer lookup for the public /verify surface. Returns ONLY the
-- provenance footer fields; never the storage_path or signing_key_id beyond
-- what the verifier needs. Callable by anon + authenticated.
CREATE OR REPLACE FUNCTION public.verify_artifact_by_sha(p_sha text)
RETURNS TABLE(
  run_id uuid,
  output_section text,
  format text,
  content_sha256 text,
  signature text,
  signing_key_id text,
  provenance_ref jsonb,
  generated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.run_id, a.output_section, a.format, a.content_sha256,
         a.signature, a.signing_key_id, a.provenance_ref, a.generated_at
  FROM public.agent_run_artifacts a
  WHERE a.content_sha256 = p_sha
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_artifact_by_sha(text) TO anon, authenticated;

-- Storage bucket: private; operators read via signed URL, service role writes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-artifacts', 'agent-artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated operators can read objects in this bucket (signed URLs work
-- regardless; this also allows direct authed reads in the operator app).
CREATE POLICY "Operators read agent-artifacts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'agent-artifacts');

-- Only service role writes; no INSERT/UPDATE/DELETE policy for other roles.
;
