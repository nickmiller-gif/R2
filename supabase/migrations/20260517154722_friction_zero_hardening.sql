-- Friction Zero hardening: outbound UPDATE RLS, watchlist privacy, evidence mutate.

DROP POLICY IF EXISTS friction_watchlist_select ON public.friction_watchlist_items;
CREATE POLICY friction_watchlist_select ON public.friction_watchlist_items
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS friction_outbound_update ON public.friction_outbound_events;
CREATE POLICY friction_outbound_update ON public.friction_outbound_events
  FOR UPDATE TO authenticated
  USING (public.friction_zero_is_operator())
  WITH CHECK (public.friction_zero_is_operator());

DROP POLICY IF EXISTS friction_evidence_update ON public.friction_dossier_evidence;
CREATE POLICY friction_evidence_update ON public.friction_dossier_evidence
  FOR UPDATE TO authenticated
  USING (public.friction_zero_is_operator())
  WITH CHECK (public.friction_zero_is_operator());

DROP POLICY IF EXISTS friction_evidence_delete ON public.friction_dossier_evidence;
CREATE POLICY friction_evidence_delete ON public.friction_dossier_evidence
  FOR DELETE TO authenticated
  USING (public.friction_zero_is_operator());;
