-- R2 Community (open-intel-commons) — public intake rows written only via Edge (service role).
-- Admins read with authenticated JWT + charter_user_roles (charter_role enum); portable for
-- preview branches — do not reference public.app_role / has_role (not created by R2 migrations).
-- Version aligned with remote migration applied via Supabase tooling (20260512030043).

CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  organization text,
  pathway text NOT NULL,
  domain text,
  message text,
  source text NOT NULL DEFAULT 'r2community_request_access',
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT access_requests_name_len CHECK (char_length(name) BETWEEN 1 AND 240),
  CONSTRAINT access_requests_email_len CHECK (char_length(email) BETWEEN 3 AND 320),
  CONSTRAINT access_requests_pathway_len CHECK (char_length(pathway) BETWEEN 1 AND 120),
  CONSTRAINT access_requests_org_len CHECK (organization IS NULL OR char_length(organization) <= 500),
  CONSTRAINT access_requests_domain_len CHECK (domain IS NULL OR char_length(domain) <= 200),
  CONSTRAINT access_requests_message_len CHECK (message IS NULL OR char_length(message) <= 8000),
  CONSTRAINT access_requests_source_len CHECK (char_length(source) <= 120),
  CONSTRAINT access_requests_status_chk CHECK (
    status = ANY (ARRAY['new'::text, 'contacted'::text, 'closed'::text, 'archived'::text])
  )
);

COMMENT ON TABLE public.access_requests IS
  'R2 Community Request Access form submissions; inserts via r2community-access-request Edge function (service role) only.';

CREATE INDEX IF NOT EXISTS access_requests_created_at_idx ON public.access_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON public.access_requests (status);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.access_requests FROM PUBLIC;
GRANT ALL ON TABLE public.access_requests TO service_role;
GRANT SELECT ON TABLE public.access_requests TO authenticated;

CREATE POLICY "Admins can select access requests"
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text = 'admin'
    )
  );
