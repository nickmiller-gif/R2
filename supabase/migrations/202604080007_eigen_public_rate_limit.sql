-- Anonymous public Eigen chat rate limiting buckets.

CREATE TABLE IF NOT EXISTS public.eigen_public_rate_buckets (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_eigen_public_rate_buckets_window_start
  ON public.eigen_public_rate_buckets (window_start DESC);

ALTER TABLE public.eigen_public_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages public eigen rate buckets"
  ON public.eigen_public_rate_buckets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.bump_eigen_public_rate(
  p_bucket_key text,
  p_window_start timestamptz DEFAULT date_trunc('minute', now())
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.eigen_public_rate_buckets (bucket_key, window_start, request_count)
  VALUES (p_bucket_key, p_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = public.eigen_public_rate_buckets.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_eigen_public_rate(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_eigen_public_rate(text, timestamptz) TO service_role;
