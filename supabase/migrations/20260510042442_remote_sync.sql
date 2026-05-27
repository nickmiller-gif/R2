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

  SELECT to_jsonb(b), b.submission_id
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

  -- Capability-by-link: whoever has the batch URL is treated as the owner
  -- and may see the full submission they wrote (including existing_solutions
  -- and additional_context). We still exclude internal user_id.
  SELECT to_jsonb(s) INTO v_submission
  FROM (
    SELECT id, idea, problem, target_customer, stage,
           existing_solutions, additional_context,
           plan_tier, created_at
    FROM public.idea_submissions
    WHERE id = v_submission_id
  ) s;

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
$$;;
