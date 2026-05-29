-- Atomic supersede RPC for eigen_policy_rules.
--
-- Problem
-- -------
-- Migration 202604240006 added partial unique indexes that enforce one
-- active rule per (policy_tag, capability_tag_pattern, effect, required_role)
-- tuple. The original PATCH path in the eigen-policy-rules edge function
-- attempted to INSERT the successor (is_active=true) first, then UPDATE
-- the predecessor to is_active=false. Whenever a PATCH preserved the
-- key tuple (the common case: rationale-only or metadata-only edits),
-- the insert collided with the predecessor's index slot and failed with
-- a unique-violation. Operators saw their edits 400 with an opaque
-- constraint error and no successor row was created.
--
-- Fix
-- ---
-- Move the swap into a single SECURITY DEFINER function executed inside
-- one transaction:
--   1. SELECT ... FOR UPDATE the predecessor (serialises concurrent
--      supersedes against the same lineage).
--   2. Guard: predecessor must exist and be active.
--   3. UPDATE the predecessor to is_active=false + superseded_by=<new id>
--      so it leaves the partial unique index BEFORE the successor enters.
--   4. INSERT the successor with the patched fields, fresh version, and
--      is_active=true.
--   5. Return both rows so the edge function can write the exact before/
--      after snapshots into eigen_policy_rule_history.
--
-- Errors surface as named SQLSTATEs so the edge function can map them
-- to stable HTTP codes:
--   P0001 -> predecessor_not_found        -> 404
--   P0002 -> predecessor_already_inactive -> 409
--   P0003 -> invalid_effect               -> 400
--
-- Callable only by service_role. The edge function already gates the
-- PATCH behind operator-class auth and idempotency-key, so the RPC is a
-- pure plumbing primitive.

CREATE OR REPLACE FUNCTION public.eigen_policy_rule_supersede(
  p_predecessor_id uuid,
  p_policy_tag text,
  p_capability_tag_pattern text,
  p_effect text,
  p_required_role charter_role,
  p_rationale text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_predecessor public.eigen_policy_rules%ROWTYPE;
  v_successor   public.eigen_policy_rules%ROWTYPE;
  v_new_id      uuid := gen_random_uuid();
  v_now         timestamptz := now();
BEGIN
  IF p_effect IS NULL OR p_effect NOT IN ('allow', 'deny') THEN
    RAISE EXCEPTION 'invalid_effect' USING ERRCODE = 'P0003';
  END IF;

  SELECT *
    INTO v_predecessor
    FROM public.eigen_policy_rules
   WHERE id = p_predecessor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'predecessor_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_predecessor.is_active = false THEN
    RAISE EXCEPTION 'predecessor_already_inactive' USING ERRCODE = 'P0002';
  END IF;

  -- Step 1: retire the predecessor first so the partial unique index slot
  -- frees up before the successor insert. Within this transaction the
  -- next statement sees the predecessor as is_active=false.
  UPDATE public.eigen_policy_rules
     SET is_active     = false,
         superseded_by = v_new_id,
         updated_at    = v_now
   WHERE id = p_predecessor_id
   RETURNING * INTO v_predecessor;

  -- Step 2: insert the successor with the patched fields and an explicit
  -- id so we can point the predecessor at it in one shot above.
  INSERT INTO public.eigen_policy_rules (
    id,
    policy_tag,
    capability_tag_pattern,
    effect,
    required_role,
    rationale,
    metadata,
    version,
    is_active,
    superseded_by,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    p_policy_tag,
    p_capability_tag_pattern,
    p_effect,
    p_required_role,
    p_rationale,
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(v_predecessor.version, 1) + 1,
    true,
    NULL,
    v_now,
    v_now
  )
  RETURNING * INTO v_successor;

  RETURN jsonb_build_object(
    'predecessor', to_jsonb(v_predecessor),
    'successor',   to_jsonb(v_successor)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.eigen_policy_rule_supersede(
  uuid, text, text, text, charter_role, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eigen_policy_rule_supersede(
  uuid, text, text, text, charter_role, text, jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.eigen_policy_rule_supersede(
  uuid, text, text, text, charter_role, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.eigen_policy_rule_supersede(
  uuid, text, text, text, charter_role, text, jsonb
) IS
  'Atomically supersedes an eigen_policy_rules row: flips the predecessor '
  'inactive and links it to a freshly inserted successor inside one '
  'transaction. Returns {predecessor, successor} as jsonb. Service-role only.';
