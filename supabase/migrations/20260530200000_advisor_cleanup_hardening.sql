-- Advisor cleanup / hardening pass (applied live on Eigen; idempotent + re-runnable).
-- Resolves: auth_rls_initplan (RLS auth.* re-eval per row), unindexed_foreign_keys,
-- duplicate_index, materialized_view_in_api, and dead API-role grants on
-- backend-only (RLS deny-all) tables.

-- 1) auth_rls_initplan: wrap bare auth.*() calls in (select ...) so they are
--    evaluated once per query (initplan) instead of per row. Behavior-identical.
do $$
declare r record; nq text; nc text; stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public','works','private_personal','storage')
      and (coalesce(qual,'')||' '||coalesce(with_check,'')) ~* 'auth\.(uid|role|jwt|email)\(\)'
      and (coalesce(qual,'')||' '||coalesce(with_check,'')) !~* '\(\s*select\s+auth\.'
  loop
    nq := r.qual; nc := r.with_check;
    if nq is not null then
      nq := regexp_replace(nq, 'auth\.uid\(\)',   '(select auth.uid())',   'g');
      nq := regexp_replace(nq, 'auth\.role\(\)',  '(select auth.role())',  'g');
      nq := regexp_replace(nq, 'auth\.jwt\(\)',   '(select auth.jwt())',   'g');
      nq := regexp_replace(nq, 'auth\.email\(\)', '(select auth.email())', 'g');
    end if;
    if nc is not null then
      nc := regexp_replace(nc, 'auth\.uid\(\)',   '(select auth.uid())',   'g');
      nc := regexp_replace(nc, 'auth\.role\(\)',  '(select auth.role())',  'g');
      nc := regexp_replace(nc, 'auth\.jwt\(\)',   '(select auth.jwt())',   'g');
      nc := regexp_replace(nc, 'auth\.email\(\)', '(select auth.email())', 'g');
    end if;
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if nq is not null then stmt := stmt || ' using (' || nq || ')'; end if;
    if nc is not null then stmt := stmt || ' with check (' || nc || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- 2) unindexed_foreign_keys: add covering indexes on FK columns lacking one.
do $$
declare r record; cols text; idxname text;
begin
  for r in
    select c.conrelid, c.conname, n.nspname sch, rel.relname tbl, c.conkey
    from pg_constraint c
    join pg_class rel on rel.oid=c.conrelid
    join pg_namespace n on n.oid=rel.relnamespace
    where c.contype='f' and n.nspname in ('public','works','private_personal')
      and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=c.conkey[1])
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
      from unnest(r.conkey) with ordinality k(attnum,ord)
      join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.attnum;
    idxname := left('ix_'||r.tbl||'_'||r.conname, 63);
    execute format('create index if not exists %I on %I.%I (%s)', idxname, r.sch, r.tbl, cols);
  end loop;
end $$;

-- 3) duplicate_index on public.meg_entity_edges
drop index if exists public.idx_meg_entity_edges_source_type;

-- 4) materialized_view_in_api: remove API-role exposure of internal MVs
revoke select on works.client_candidate_identity from anon, authenticated;
revoke select on public.generational_brand_index from anon, authenticated;

-- 5) Dead API-role grants on backend-only (RLS deny-all) tables — defense in depth.
do $$
declare r record;
begin
  for r in select n.nspname sch, t.relname tbl from pg_class t
    join pg_namespace n on n.oid=t.relnamespace
    where t.relkind='r' and n.nspname in ('public','works')
      and t.relname in ('ai_trust_feedback','batch_messages','entity_enrichment_evidence',
        'entity_enrichment_field_consensus','entity_enrichment_review_queue',
        'entity_enrichment_run_checkpoints','text_origin_feedback','webhook_sources')
  loop
    execute format('revoke all on %I.%I from anon, authenticated', r.sch, r.tbl);
  end loop;
end $$;

-- 6) anon/authenticated must NOT directly invoke service-role-only mutating
--    SECURITY DEFINER internals (service_role retains EXECUTE).
do $$
declare r record; internal text[] := array[
  'apply_meg_entity_projection_patch','botos_claim_next_bot_task','ensure_client_meg_linkage',
  'meg_link_entities','meg_resolve_or_create','meg_upsert_person_attendee_sidecar',
  'meg_upsert_thesis_sidecar','schedule_eigen_memory_episodes_cron','resolve_client_candidate'];
begin
  for r in select n.nspname sch, p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prosecdef and n.nspname in ('public','works') and p.proname = any(internal)
  loop
    execute format('revoke execute on function %I.%I(%s) from anon, authenticated', r.sch, r.proname, r.args);
  end loop;
end $$;
