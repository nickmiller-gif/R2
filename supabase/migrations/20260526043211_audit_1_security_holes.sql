drop policy if exists "anon insert batch msgs" on public.batch_messages;
drop policy if exists "anon read batch msgs"  on public.batch_messages;
drop policy if exists "Anyone can submit rr photos" on public.rr_photo_submissions;

revoke execute on function public.bootstrap_admin_role(uuid)                       from anon, authenticated, public;
revoke execute on function public.rls_auto_enable()                                from anon, authenticated, public;
revoke execute on function public.backfill_asset_registry_phase1(boolean)          from anon, authenticated, public;
revoke execute on function public.dispatch_embedding_jobs()                        from anon, authenticated, public;
revoke execute on function public.enqueue_embedding_job()                          from anon, authenticated, public;
revoke execute on function public.enqueue_platform_feed_processing(uuid)           from anon, authenticated, public;
revoke execute on function public.claim_platform_feed_items(integer)               from anon, authenticated, public;
revoke execute on function public.expire_stale_operator_proposals()                from anon, authenticated, public;
revoke execute on function public.claim_operator_proposals_for_review(integer)     from anon, authenticated, public;
revoke execute on function public.pgmq_delete(text, bigint)                        from anon, authenticated, public;
revoke execute on function public.schedule_generate_thought_piece_cron()           from anon, authenticated, public;
revoke execute on function public.decide_operator_proposal(uuid, text, uuid, text, jsonb)            from anon, authenticated, public;
revoke execute on function public.truth_market_promote(text, text, text, text, text[], uuid, uuid, uuid[], uuid[], jsonb, jsonb, jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.truth_market_promote_feed_cluster(text, integer, text, uuid)      from anon, authenticated, public;
revoke execute on function public.handle_new_user()                                 from anon, authenticated, public;
revoke execute on function works.trg_enqueue_promoted_dossier_reference()           from anon, authenticated, public;
revoke execute on function works.trg_refresh_gap_suggested_contacts()               from anon, authenticated, public;
revoke execute on function works.trg_notify_audit_event()                           from anon, authenticated, public;
revoke execute on function works.apply_owsr_writeback_result(uuid, jsonb, jsonb, integer) from anon, authenticated, public;
revoke execute on function works.refresh_gap_suggested_contacts(uuid, integer)            from anon, authenticated, public;
revoke execute on function works.refresh_entity_graph_from_candidates(integer)            from anon, authenticated, public;
revoke execute on function works.schedule_ingest(works.ingest_source, text)               from anon, authenticated, public;

alter table works.legislation_jurisdiction_aliases enable row level security;
grant select on works.legislation_jurisdiction_aliases to authenticated;
drop policy if exists legislation_jurisdiction_aliases_select on works.legislation_jurisdiction_aliases;
create policy legislation_jurisdiction_aliases_select
  on works.legislation_jurisdiction_aliases
  for select
  to authenticated
  using (public.is_active_operator(auth.uid()));;
