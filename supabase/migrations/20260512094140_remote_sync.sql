
DO $$ BEGIN
  CREATE TYPE public.publication_domain AS ENUM ('ip_patent', 'public_health', 'real_estate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.publication_status AS ENUM ('draft', 'in_review', 'published', 'retracted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.publication_author_role AS ENUM ('lead', 'contributor', 'reviewer', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.is_publications_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('reviewer'::public.app_role, 'editor'::public.app_role, 'admin'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_publications_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('editor'::public.app_role, 'admin'::public.app_role)
  )
$$;

CREATE TABLE IF NOT EXISTS public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  deck text,
  domain public.publication_domain NOT NULL,
  abstract text,
  status public.publication_status NOT NULL DEFAULT 'draft',
  version text NOT NULL DEFAULT '1.0.0',
  doi text,
  published_at timestamptz,
  retracted_at timestamptz,
  cover_image_path text,
  og_image_path text,
  license text NOT NULL DEFAULT 'CC0 1.0',
  lead_author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_publications_status ON public.publications(status);
CREATE INDEX IF NOT EXISTS idx_publications_domain ON public.publications(domain);
CREATE INDEX IF NOT EXISTS idx_publications_lead_author ON public.publications(lead_author_id);
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS publications_set_updated_at ON public.publications;
CREATE TRIGGER publications_set_updated_at
  BEFORE UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.publication_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role public.publication_author_role NOT NULL DEFAULT 'contributor',
  ordinal int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_pub_authors_publication ON public.publication_authors(publication_id);
CREATE INDEX IF NOT EXISTS idx_pub_authors_profile ON public.publication_authors(profile_id);
ALTER TABLE public.publication_authors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_publication(_user_id uuid, _publication_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.publications p
    WHERE p.id = _publication_id
      AND (
        p.status = 'published'
        OR p.lead_author_id = _user_id
        OR EXISTS (SELECT 1 FROM public.publication_authors pa WHERE pa.publication_id = p.id AND pa.profile_id = _user_id)
        OR public.is_publications_staff(_user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_publication(_user_id uuid, _publication_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.publications p
    WHERE p.id = _publication_id
      AND (
        p.lead_author_id = _user_id
        OR EXISTS (SELECT 1 FROM public.publication_authors pa WHERE pa.publication_id = p.id AND pa.profile_id = _user_id)
        OR public.is_publications_staff(_user_id)
      )
  )
$$;

CREATE POLICY publications_public_read ON public.publications
  FOR SELECT USING (
    status = 'published'
    OR lead_author_id = auth.uid()
    OR public.is_publications_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.publication_authors pa WHERE pa.publication_id = publications.id AND pa.profile_id = auth.uid())
  );

CREATE POLICY publications_contributor_insert ON public.publications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND lead_author_id = auth.uid()
    AND status IN ('draft', 'in_review')
  );

CREATE POLICY publications_author_update ON public.publications
  FOR UPDATE USING (
    lead_author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.publication_authors pa WHERE pa.publication_id = publications.id AND pa.profile_id = auth.uid())
    OR public.is_publications_staff(auth.uid())
  )
  WITH CHECK (
    public.is_publications_editor(auth.uid())
    OR status IN ('draft', 'in_review')
  );

CREATE POLICY publications_editor_delete ON public.publications
  FOR DELETE USING (public.is_publications_editor(auth.uid()));

CREATE POLICY pub_authors_read ON public.publication_authors
  FOR SELECT USING (public.can_read_publication(auth.uid(), publication_id));
CREATE POLICY pub_authors_write ON public.publication_authors
  FOR ALL USING (public.can_edit_publication(auth.uid(), publication_id))
  WITH CHECK (public.can_edit_publication(auth.uid(), publication_id));

CREATE TABLE IF NOT EXISTS public.publication_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  version text NOT NULL,
  changelog text,
  body_md text,
  body_html text,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, version)
);
CREATE INDEX IF NOT EXISTS idx_pub_versions_publication ON public.publication_versions(publication_id);
ALTER TABLE public.publication_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_versions_read ON public.publication_versions
  FOR SELECT USING (public.can_read_publication(auth.uid(), publication_id));
CREATE POLICY pub_versions_write ON public.publication_versions
  FOR ALL USING (public.can_edit_publication(auth.uid(), publication_id))
  WITH CHECK (public.can_edit_publication(auth.uid(), publication_id));

CREATE TABLE IF NOT EXISTS public.publication_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  ordinal int NOT NULL DEFAULT 0,
  citation_text text NOT NULL,
  source_url text,
  doi text,
  accessed_at date,
  evidence_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pub_citations_publication ON public.publication_citations(publication_id);
ALTER TABLE public.publication_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_citations_read ON public.publication_citations
  FOR SELECT USING (public.can_read_publication(auth.uid(), publication_id));
CREATE POLICY pub_citations_write ON public.publication_citations
  FOR ALL USING (public.can_edit_publication(auth.uid(), publication_id))
  WITH CHECK (public.can_edit_publication(auth.uid(), publication_id));

CREATE TABLE IF NOT EXISTS public.publication_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_pub_tags_publication ON public.publication_tags(publication_id);
CREATE INDEX IF NOT EXISTS idx_pub_tags_tag ON public.publication_tags(tag);
ALTER TABLE public.publication_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_tags_read ON public.publication_tags
  FOR SELECT USING (public.can_read_publication(auth.uid(), publication_id));
CREATE POLICY pub_tags_write ON public.publication_tags
  FOR ALL USING (public.can_edit_publication(auth.uid(), publication_id))
  WITH CHECK (public.can_edit_publication(auth.uid(), publication_id));

CREATE TABLE IF NOT EXISTS public.publication_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  from_status public.publication_status,
  to_status public.publication_status NOT NULL,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pub_audit_publication ON public.publication_audit_log(publication_id);
ALTER TABLE public.publication_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_audit_read ON public.publication_audit_log
  FOR SELECT USING (public.can_read_publication(auth.uid(), publication_id));
CREATE POLICY pub_audit_insert ON public.publication_audit_log
  FOR INSERT WITH CHECK (public.is_publications_editor(auth.uid()));

INSERT INTO storage.buckets (id, name, public) VALUES ('publication-covers', 'publication-covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('publication-pdfs', 'publication-pdfs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-avatars', 'profile-avatars', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY pub_covers_public_read ON storage.objects FOR SELECT USING (bucket_id = 'publication-covers');
CREATE POLICY pub_covers_auth_upload ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'publication-covers' AND auth.uid() IS NOT NULL);
CREATE POLICY pub_covers_owner_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'publication-covers' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_publications_editor(auth.uid())));
CREATE POLICY pub_covers_owner_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'publication-covers' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_publications_editor(auth.uid())));

CREATE POLICY pub_pdfs_public_read ON storage.objects FOR SELECT USING (bucket_id = 'publication-pdfs');
CREATE POLICY pub_pdfs_auth_upload ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'publication-pdfs' AND auth.uid() IS NOT NULL);
CREATE POLICY pub_pdfs_owner_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'publication-pdfs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_publications_editor(auth.uid())));
CREATE POLICY pub_pdfs_owner_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'publication-pdfs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_publications_editor(auth.uid())));

CREATE POLICY profile_avatars_public_read ON storage.objects FOR SELECT USING (bucket_id = 'profile-avatars');
CREATE POLICY profile_avatars_auth_upload ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-avatars' AND auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY profile_avatars_owner_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY profile_avatars_owner_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
;
