CREATE TABLE public.public_resolve_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.public_resolve_rate_limits TO service_role;

ALTER TABLE public.public_resolve_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to rate limits"
ON public.public_resolve_rate_limits
FOR SELECT
TO anon, authenticated
USING (false);

CREATE INDEX idx_public_resolve_rate_limits_window
  ON public.public_resolve_rate_limits (window_started_at);;
