-- Seed charter_entities rows so generational_brand_index.atlas_page_count joins Atlas crawls by brand_key.
-- Idempotent: skips when metadata.atlas_brand_key already exists.
-- Tolerant: in environments where auth.users is empty (Supabase Preview, fresh
-- dev DBs) the seed is a no-op; production runs the INSERT as before because
-- a user already exists.

DO $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT id INTO v_owner
  FROM auth.users
  WHERE email = 'nick.miller@tacendalaw.com'
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RAISE NOTICE 'seed_charter_atlas_brand_keys: no auth.users row available, skipping seed';
  ELSE
    INSERT INTO public.charter_entities (name, entity_type, created_by, status, metadata)
    SELECT v.name, 'product'::public.entity_type, v_owner, 'active'::public.entity_status, v.metadata
    FROM (
      VALUES
        ('CentralR2', '{"atlas_brand_key":"centralr2-core"}'::jsonb),
        ('R2Works', '{"atlas_brand_key":"operator-workbench"}'::jsonb),
        ('R2Chart', '{"atlas_brand_key":"r2chart"}'::jsonb),
        ('R2-IP', '{"atlas_brand_key":"ip-pulse-point"}'::jsonb)
    ) AS v(name, metadata)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.charter_entities ce
      WHERE ce.metadata ->> 'atlas_brand_key' = v.metadata ->> 'atlas_brand_key'
    );
  END IF;
END $$;

REFRESH MATERIALIZED VIEW public.generational_brand_index;
