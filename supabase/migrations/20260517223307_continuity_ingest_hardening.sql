DROP POLICY IF EXISTS continuity_signal_items_insert_authenticated ON public.continuity_signal_items;
CREATE POLICY continuity_signal_items_insert_authenticated
  ON public.continuity_signal_items FOR INSERT TO authenticated
  WITH CHECK (public.continuity_is_admin());;
