-- Harden chat turn RLS by tying row access to ownership of referenced session.

DROP POLICY IF EXISTS "Users can read their own chat turns" ON public.eigen_chat_turns;
DROP POLICY IF EXISTS "Users can insert their own chat turns" ON public.eigen_chat_turns;
DROP POLICY IF EXISTS "Users can delete their own chat turns" ON public.eigen_chat_turns;

CREATE POLICY "Users can read their own chat turns"
  ON public.eigen_chat_turns FOR SELECT
  USING (
    ((SELECT auth.uid()) = owner_id)
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_sessions
      WHERE public.eigen_chat_sessions.id = public.eigen_chat_turns.session_id
        AND public.eigen_chat_sessions.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert their own chat turns"
  ON public.eigen_chat_turns FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = owner_id)
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_sessions
      WHERE public.eigen_chat_sessions.id = public.eigen_chat_turns.session_id
        AND public.eigen_chat_sessions.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete their own chat turns"
  ON public.eigen_chat_turns FOR DELETE
  USING (
    ((SELECT auth.uid()) = owner_id)
    AND EXISTS (
      SELECT 1
      FROM public.eigen_chat_sessions
      WHERE public.eigen_chat_sessions.id = public.eigen_chat_turns.session_id
        AND public.eigen_chat_sessions.owner_id = (SELECT auth.uid())
    )
  );
