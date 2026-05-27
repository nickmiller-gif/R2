
DROP POLICY IF EXISTS botos_bot_tasks_select_anon ON public.botos_bot_tasks;
DROP POLICY IF EXISTS botos_capability_grants_select_anon ON public.botos_capability_grants;
DROP POLICY IF EXISTS botos_bot_tasks_select_authenticated ON public.botos_bot_tasks;
DROP POLICY IF EXISTS botos_capability_grants_select_authenticated ON public.botos_capability_grants;
CREATE POLICY botos_bot_tasks_select_operator ON public.botos_bot_tasks
  FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()));
CREATE POLICY botos_capability_grants_select_operator ON public.botos_capability_grants
  FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()));

DROP POLICY IF EXISTS charter_entities_read ON public.charter_entities;
CREATE POLICY charter_entities_read ON public.charter_entities
  FOR SELECT TO authenticated USING (public.has_charter_access(auth.uid()));

DROP POLICY IF EXISTS governance_entity_read ON public.charter_governance_entities;
CREATE POLICY governance_entity_read ON public.charter_governance_entities
  FOR SELECT TO authenticated USING (public.has_charter_access(auth.uid()));

DROP POLICY IF EXISTS governance_transition_read ON public.charter_governance_transitions;
CREATE POLICY governance_transition_read ON public.charter_governance_transitions
  FOR SELECT TO authenticated USING (public.has_charter_access(auth.uid()));

DROP POLICY IF EXISTS audit_log_read ON public.charter_provenance_events;
CREATE POLICY audit_log_read ON public.charter_provenance_events
  FOR SELECT TO authenticated USING (public.has_charter_access(auth.uid()));

DROP POLICY IF EXISTS charter_obligations_read ON public.charter_obligations;
CREATE POLICY charter_obligations_read ON public.charter_obligations
  FOR SELECT TO authenticated USING (public.has_charter_access(auth.uid()));

DROP POLICY IF EXISTS charter_payouts_read ON public.charter_payouts;
CREATE POLICY charter_payouts_read ON public.charter_payouts
  FOR SELECT TO authenticated USING (public.has_charter_access(auth.uid()));

DROP POLICY IF EXISTS charter_user_roles_read ON public.charter_user_roles;

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOR t, pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename LIKE 'continuity_%'
      AND cmd='SELECT' AND 'authenticated' = ANY(roles) AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_operator(auth.uid()))',
      pol, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated users can upload portfolio docs" ON storage.objects;
CREATE POLICY "Authenticated users can upload portfolio docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'central-portfolio-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Anyone can upload idea attachments" ON storage.objects;
;
