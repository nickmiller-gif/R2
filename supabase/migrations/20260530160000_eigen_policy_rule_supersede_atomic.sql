-- Atomic supersede flow for eigen_policy_rules.
--
-- Context:
--   The eigen-policy-rules edge function performed PATCH (supersede) as a
--   sequence of four separate Supabase calls:
--     1) INSERT successor row with is_active=true and version+1
--     2) UPDATE predecessor SET is_active=false, superseded_by=successor.id
--     3) INSERT 'supersede' history row
--     4) INSERT 'create' history row for the successor
--
--   That order has two flaws that this migration closes:
--
--   (A) Index violation on no-key-change PATCH.
--       The partial unique indexes idx_eigen_policy_rules_one_active_*
--       (added in 202604240006) cover (policy_tag, capability_tag_pattern,
--       effect, required_role) WHERE is_active=true. Step 1 inserts a row
--       with is_active=true *while the predecessor is still active*, so any
--       PATCH that does not touch one of those four columns — the common
--       case of updating just rationale or metadata — fails with a unique
--       violation before step 2 ever runs. Operators cannot adjust a
--       rule's rationale via the documented PATCH surface today.
--
--   (B) Audit-fail-soft window.
--       Steps 1–2 commit the rule mutation; steps 3–4 are best-effort
--       audit inserts whose failure was reported as `auditWarnings` but
--       did not roll back the rule change. For a compliance system whose
--       core invariant is "every rule mutation has a corresponding
--       history row", silently dropping audit on a transient error is a
--       hole.
--
-- Design:
--   This migration adds a SECURITY DEFINER plpgsql function that performs
--   the entire supersede inside a single transaction:
--     1) FOR UPDATE lock on predecessor (blocks concurrent supersedes).
--     2) Validate predecessor is still active.
--     3) Flip predecessor to is_active=false (releases its index slot).
--     4) Insert successor with version+1 and is_active=true.
--     5) Set predecessor.superseded_by = successor.id.
--     6) Insert 'supersede' history row (before/after = predecessor).
--     7) Insert 'create' history row for successor.
--   Returns the full successor row as jsonb. Any failure rolls back the
--   entire transaction so the rule, the lineage pointer, and both audit
--   rows are always in lockstep.
--
--   The function is GRANT EXECUTEd to service_role only. RBAC / input
--   validation stays in the edge function — this layer is dumb glue.
--
-- Behavior change:
--   Audit failures now surface as 5xx and roll back the rule change. The
--   previous `auditWarnings` array is no longer emitted from PATCH. Create
--   and DELETE keep their existing audit-soft semantics until a follow-up
--   slice unifies them on the same RPC pattern.
--
-- Additive + idempotent. CREATE OR REPLACE FUNCTION makes re-apply safe.

CREATE OR REPLACE FUNCTION public.supersede_eigen_policy_rule(
  p_rule_id uuid,
  p_patch jsonb,
  p_actor_id uuid,
  p_correlation_id text,
  p_rationale text,
  p_history_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_predecessor public.eigen_policy_rules;
  v_predecessor_before jsonb;
  v_predecessor_after public.eigen_policy_rules;
  v_successor public.eigen_policy_rules;
  v_next_policy_tag text;
  v_next_pattern text;
  v_next_effect text;
  v_next_required_role public.charter_role;
  v_next_rationale text;
  v_next_metadata jsonb;
BEGIN
  -- Lock predecessor so concurrent supersedes on the same rule_id serialize.
  SELECT *
    INTO v_predecessor
    FROM public.eigen_policy_rules
   WHERE id = p_rule_id
   FOR UPDATE;

  IF v_predecessor.id IS NULL THEN
    RAISE EXCEPTION 'Rule not found: %', p_rule_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_predecessor.is_active = false THEN
    RAISE EXCEPTION
      'Cannot supersede an already-inactive rule (%); start from its active successor',
      p_rule_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Snapshot predecessor before mutation for the audit before_state.
  v_predecessor_before := to_jsonb(v_predecessor);

  -- Compute successor field values: copy predecessor, layer patch.
  -- Use `?` (jsonb key present) so explicit null clears a field while
  -- absence falls back to predecessor's value.
  IF p_patch ? 'policy_tag' THEN
    v_next_policy_tag := p_patch ->> 'policy_tag';
  ELSE
    v_next_policy_tag := v_predecessor.policy_tag;
  END IF;

  IF p_patch ? 'capability_tag_pattern' THEN
    v_next_pattern := p_patch ->> 'capability_tag_pattern';
  ELSE
    v_next_pattern := v_predecessor.capability_tag_pattern;
  END IF;

  IF p_patch ? 'effect' THEN
    v_next_effect := p_patch ->> 'effect';
  ELSE
    v_next_effect := v_predecessor.effect;
  END IF;

  IF p_patch ? 'required_role' THEN
    v_next_required_role := NULLIF(p_patch ->> 'required_role', '')::public.charter_role;
  ELSE
    v_next_required_role := v_predecessor.required_role;
  END IF;

  IF p_patch ? 'rationale' THEN
    v_next_rationale := p_patch ->> 'rationale';
  ELSE
    v_next_rationale := v_predecessor.rationale;
  END IF;

  IF p_patch ? 'metadata' THEN
    v_next_metadata := COALESCE(p_patch -> 'metadata', '{}'::jsonb);
  ELSE
    v_next_metadata := v_predecessor.metadata;
  END IF;

  -- Step 1: flip predecessor inactive BEFORE inserting successor so the
  -- partial unique index on active rows does not collide when the patch
  -- leaves all key columns unchanged.
  UPDATE public.eigen_policy_rules
     SET is_active = false,
         updated_at = now()
   WHERE id = p_rule_id;

  -- Step 2: insert successor.
  INSERT INTO public.eigen_policy_rules (
    policy_tag,
    capability_tag_pattern,
    effect,
    required_role,
    rationale,
    metadata,
    version,
    is_active
  ) VALUES (
    v_next_policy_tag,
    v_next_pattern,
    v_next_effect,
    v_next_required_role,
    v_next_rationale,
    v_next_metadata,
    COALESCE(v_predecessor.version, 1) + 1,
    true
  )
  RETURNING * INTO v_successor;

  -- Step 3: point predecessor at successor for lineage traversal.
  UPDATE public.eigen_policy_rules
     SET superseded_by = v_successor.id
   WHERE id = p_rule_id
   RETURNING * INTO v_predecessor_after;

  -- Step 4: history rows. Both must commit with the rule mutation — any
  -- failure rolls back the entire transaction.
  INSERT INTO public.eigen_policy_rule_history (
    rule_id, action, before_state, after_state,
    actor_id, correlation_id, rationale, metadata
  ) VALUES (
    p_rule_id,
    'supersede',
    v_predecessor_before,
    to_jsonb(v_predecessor_after),
    p_actor_id,
    p_correlation_id,
    p_rationale,
    COALESCE(p_history_metadata, '{}'::jsonb)
      || jsonb_build_object('successor_rule_id', v_successor.id)
  );

  INSERT INTO public.eigen_policy_rule_history (
    rule_id, action, before_state, after_state,
    actor_id, correlation_id, rationale, metadata
  ) VALUES (
    v_successor.id,
    'create',
    NULL,
    to_jsonb(v_successor),
    p_actor_id,
    p_correlation_id,
    p_rationale,
    COALESCE(p_history_metadata, '{}'::jsonb)
      || jsonb_build_object('predecessor_rule_id', p_rule_id)
  );

  RETURN to_jsonb(v_successor);
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.supersede_eigen_policy_rule(uuid, jsonb, uuid, text, text, jsonb)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.supersede_eigen_policy_rule(uuid, jsonb, uuid, text, text, jsonb)
  TO service_role;
