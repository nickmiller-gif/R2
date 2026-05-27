-- ── 1. Drop public anon SELECT policies on analytical tables ────────────────
DROP POLICY IF EXISTS "anon read batches" ON public.validation_batches;
DROP POLICY IF EXISTS "anon read reports" ON public.validation_reports;
DROP POLICY IF EXISTS "anon read agent runs" ON public.agent_runs;
DROP POLICY IF EXISTS "anon read agent steps" ON public.agent_steps;
DROP POLICY IF EXISTS "anon read agent evidence" ON public.agent_evidence;
DROP POLICY IF EXISTS "anon read synth interviews" ON public.synthetic_interviews;
DROP POLICY IF EXISTS "anon read claim checks" ON public.claim_checks;
DROP POLICY IF EXISTS "anon read model reviews" ON public.model_reviews;

-- ── 2. Reviewer/admin SELECT policies (authenticated only) ──────────────────
CREATE POLICY "reviewers read batches" ON public.validation_batches
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read reports" ON public.validation_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read agent runs" ON public.agent_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read agent steps" ON public.agent_steps
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read agent evidence" ON public.agent_evidence
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read synth interviews" ON public.synthetic_interviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read claim checks" ON public.claim_checks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reviewers read model reviews" ON public.model_reviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'admin'));

-- ── 3. Capability-by-link RPC for public /status and /report pages ──────────
CREATE OR REPLACE FUNCTION public.get_public_batch_view(p_batch_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch jsonb;
  v_submission jsonb;
  v_report jsonb;
  v_run jsonb;
  v_steps jsonb;
  v_run_id uuid;
  v_submission_id uuid;
BEGIN
  IF p_batch_id IS NULL OR length(btrim(p_batch_id)) = 0 THEN
    RETURN jsonb_build_object('error', 'batch_id required');
  END IF;

  SELECT to_jsonb(b) - 'sla_deadline_internal_notes', b.submission_id
    INTO v_batch, v_submission_id
  FROM (
    SELECT id, submission_id, status, researcher_id,
           interviews_target, interviews_completed,
           sla_deadline, created_at
    FROM public.validation_batches
    WHERE id = p_batch_id
  ) b;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'batch not found');
  END IF;

  -- batch_steps embed
  v_batch := v_batch || jsonb_build_object(
    'batch_steps',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sort_order)
      FROM (
        SELECT label, status, completed_at, sort_order, error
        FROM public.batch_steps
        WHERE batch_id = p_batch_id
      ) s
    ), '[]'::jsonb)
  );

  -- Sanitised submission (no existing_solutions / additional_context — those
  -- can contain sensitive strategy notes and aren't needed by public views).
  SELECT to_jsonb(s) INTO v_submission
  FROM (
    SELECT id, idea, problem, target_customer, stage, plan_tier, created_at
    FROM public.idea_submissions
    WHERE id = v_submission_id
  ) s;

  -- Latest report
  SELECT to_jsonb(r) INTO v_report
  FROM (
    SELECT id, batch_id, score, confidence, verdict, summary,
           themes, interviews, recommendations,
           researcher_name, researcher_title, completed_at,
           review_status, tier
    FROM public.validation_reports
    WHERE batch_id = p_batch_id
    ORDER BY completed_at DESC NULLS LAST
    LIMIT 1
  ) r;

  -- Latest agent run + its steps
  SELECT to_jsonb(ar), ar.id INTO v_run, v_run_id
  FROM (
    SELECT id, status, current_stage, tier,
           started_at, finished_at, total_tokens, error
    FROM public.agent_runs
    WHERE batch_id = p_batch_id
    ORDER BY created_at DESC
    LIMIT 1
  ) ar;

  v_steps := COALESCE((
    SELECT jsonb_agg(to_jsonb(st) ORDER BY st.sort_order)
    FROM (
      SELECT id, stage, status, sort_order, started_at,
             finished_at, duration_ms, tokens, error, tool_name
      FROM public.agent_steps
      WHERE run_id = v_run_id
    ) st
  ), '[]'::jsonb);

  RETURN jsonb_build_object(
    'batch', v_batch,
    'submission', v_submission,
    'report', v_report,
    'agent_run', v_run,
    'agent_steps', v_steps
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_batch_view(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_batch_view(text) TO anon, authenticated;

-- ── 4. validation_reports idempotency ───────────────────────────────────────
-- Dedupe existing duplicates first (keep newest per batch_id)
DELETE FROM public.validation_reports vr
USING (
  SELECT id, batch_id,
         row_number() OVER (PARTITION BY batch_id ORDER BY completed_at DESC NULLS LAST, created_at DESC) AS rn
  FROM public.validation_reports
) ranked
WHERE ranked.id = vr.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS validation_reports_batch_id_unique
  ON public.validation_reports(batch_id);;
