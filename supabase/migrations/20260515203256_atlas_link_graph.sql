-- Atlas (Initiative 1 — Mycelium): crawl runs, discovered URLs, directional links, snapshot placeholders.
-- Week 1: schema + RLS; sitemap_parent links written by scripts/eigen-public-sitemap-ingest.py --write-atlas-links.

CREATE TYPE atlas_crawl_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE atlas_crawl_source AS ENUM ('sitemap', 'html');

CREATE TABLE public.atlas_crawls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_key text NOT NULL,
  source atlas_crawl_source NOT NULL DEFAULT 'sitemap',
  status atlas_crawl_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_atlas_crawls_brand_key_started ON public.atlas_crawls (brand_key, started_at DESC);

CREATE TABLE public.atlas_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id uuid NOT NULL REFERENCES public.atlas_crawls (id) ON DELETE CASCADE,
  url text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  ingest_ok boolean,
  last_error text,
  CONSTRAINT atlas_urls_crawl_url_unique UNIQUE (crawl_id, url)
);

CREATE INDEX idx_atlas_urls_crawl_id ON public.atlas_urls (crawl_id);

CREATE TABLE public.atlas_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id uuid NOT NULL REFERENCES public.atlas_crawls (id) ON DELETE CASCADE,
  from_url text NOT NULL,
  to_url text NOT NULL,
  link_kind text NOT NULL CHECK (link_kind IN ('sitemap_parent', 'html_a')),
  CONSTRAINT atlas_links_crawl_edge_unique UNIQUE (crawl_id, from_url, to_url, link_kind)
);

CREATE INDEX idx_atlas_links_crawl_from ON public.atlas_links (crawl_id, from_url);
CREATE INDEX idx_atlas_links_crawl_to ON public.atlas_links (crawl_id, to_url);

CREATE TABLE public.atlas_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id uuid REFERENCES public.atlas_crawls (id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX idx_atlas_snapshots_crawl_id ON public.atlas_snapshots (crawl_id);

COMMENT ON TABLE public.atlas_crawls IS
  'Atlas crawl run metadata (brand_key + source). Populated by batch ingest / crawler scripts.';
COMMENT ON TABLE public.atlas_urls IS
  'URLs discovered during a crawl; ingest_ok/last_error mirror eigen-fetch-ingest outcomes when recorded.';
COMMENT ON TABLE public.atlas_links IS
  'Directed edges: sitemap_parent = sitemap XML URL to page loc; html_a reserved for in-page href graph.';
COMMENT ON TABLE public.atlas_snapshots IS
  'Time-machine pointer rows; retention policy applied in later phases.';

-- RLS: readable by authenticated members; writes via service_role (scripts / edge only).
ALTER TABLE public.atlas_crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY atlas_crawls_read ON public.atlas_crawls
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY atlas_crawls_write ON public.atlas_crawls
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY atlas_urls_read ON public.atlas_urls
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY atlas_urls_write ON public.atlas_urls
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY atlas_links_read ON public.atlas_links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY atlas_links_write ON public.atlas_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY atlas_snapshots_read ON public.atlas_snapshots
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY atlas_snapshots_write ON public.atlas_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
