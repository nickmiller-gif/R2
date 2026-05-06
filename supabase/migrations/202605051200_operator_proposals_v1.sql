-- operator_proposals v1 — agent-drafted action layer above platform_feed_items.
--
-- Purpose
--   Phase 1–6 surfaces signals to the operator via Today.tsx. This migration
--   adds the next layer up: agent-drafted *proposed actions* that the operator
--   approves, modifies, or rejects. The same drafter (a Cloudflare Worker that
--   subscribes to platform_feed_items realtime) reads MEG and the Oracle corpus
--   and writes one or more rows here per qualifying signal.
--
-- Relationship to existing tables
--   * Each proposal is anchored to one or more rows in platform_feed_items via
--     `triggering_signal_ids uuid[]`. The first element is the primary trigger;
--     remaining elements are correlated signals (cross-brand, MEG-resolved).
--   * actor_meg_entity_id mirrors the source signal's actor when applicable.
--   * downstream_run_id links to oracle_runs once an approved proposal has
--     produced a whitespace run; null until that hop occurs.
--
-- Decision flow
--   draft -> queued -> in_review -> { approved | modified | rejected | expired }
--   approved/modified -> executing -> { executed | execution_failed }
--
-- This migration is additive. It does not alter platform_feed_items.

CREATE TABLE IF NOT EXISTS public.operator_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance
  drafter text NOT NULL,                          -- e.g. 'r2-proposal-drafter@v1'
  drafter_run_id uuid,                            -- per-invocation drafter run id
  triggering_signal_ids uuid[] NOT NULL,
  actor_meg_entity_id uuid REFERENCES public.meg_entities(id) ON DELETE SET NULL,
  related_entity_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  cross_brand_count smallint NOT NULL DEFAULT 1,  -- distinct source_systems represented
  source_systems text[] NOT NULL DEFAULT '{}'::text[],

  -- The draft itself
  proposal_kind text NOT NULL CHECK (
    proposal_kind IN (
      'cross_brand_correlation',
      'whitespace_followup',
      'charter_obligation',
      'retreat_action',
      'ip_action',
      'commerce_action',
      'health_action',
      'platform_action',
      'other'
    )
  ),
  title text NOT NULL CHECK (char_length(title) <= 200),
  rationale text NOT NULL CHECK (char_length(rationale) <= 4000),
  proposed_actions jsonb NOT NULL,               -- ordered list: [{ kind, target, args, reversal_hint }, ...]
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,  -- considered-but-not-chosen variants
  evidence_chunk_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  evidence_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  confidence numeric(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  estimated_reversal_cost text CHECK (
    estimated_reversal_cost IN ('trivial', 'cheap', 'moderate', 'expensive', 'irreversible')
  ),

  -- State machine
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'queued',
      'in_review',
      'approved',
      'modified',
      'rejected',
      'expired',
      'executing',
      'executed',
      'execution_failed'
    )
  ),
  reviewed_by uuid,                               -- charter_user_roles.user_id
  reviewed_at timestamptz,
  review_notes text,
  modified_actions jsonb,                         -- when status='modified', the operator's edit

  -- Execution
  execution_started_at timestamptz,
  executed_at timestamptz,
  downstream_run_id uuid,                         -- oracle_runs / r2_signal envelope id
  execution_error text,

  -- Lifecycle
  drafted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,                         -- staleness gate (e.g. 14d default in worker)
  privacy_level text NOT NULL DEFAULT 'operator' CHECK (
    privacy_level IN ('operator', 'counsel', 'admin')
  )
);

-- Indexes mirror platform_feed_items style: filtered partials + GIN for arrays.
CREATE INDEX IF NOT EXISTS operator_proposals_status_idx
  ON public.operator_proposals (status, drafted_at DESC);

CREATE INDEX IF NOT EXISTS operator_proposals_in_review_idx
  ON public.operator_proposals (drafted_at DESC)
  WHERE status IN ('queued', 'in_review');

CREATE INDEX IF NOT EXISTS operator_proposals_actor_idx
  ON public.operator_proposals (actor_meg_entity_id)
  WHERE actor_meg_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operator_proposals_triggering_signals_idx
  ON public.operator_proposals USING gin (triggering_signal_ids);

CREATE INDEX IF NOT EXISTS operator_proposals_related_entity_ids_idx
  ON public.operator_proposals USING gin (related_entity_ids);

CREATE INDEX IF NOT EXISTS operator_proposals_source_systems_idx
  ON public.operator_proposals USING gin (source_systems);

CREATE INDEX IF NOT EXISTS operator_proposals_cross_brand_idx
  ON public.operator_proposals (cross_brand_count DESC, drafted_at DESC)
  WHERE cross_brand_count >= 2;

-- RLS: matches platform_feed_items policy shape exactly.
ALTER TABLE public.operator_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_operator_proposals ON public.operator_proposals;
CREATE POLICY select_operator_proposals ON public.operator_proposals
  FOR SELECT TO authenticated, service_role
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_operator_proposals ON public.operator_proposals;
CREATE POLICY insert_operator_proposals ON public.operator_proposals
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Operator updates routed through RPCs (decide_operator_proposal); direct
-- updates from authenticated users are blocked. Service role retains full
-- update for the drafter and execution worker.
DROP POLICY IF EXISTS update_operator_proposals ON public.operator_proposals;
CREATE POLICY update_operator_proposals ON public.operator_proposals
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS delete_operator_proposals ON public.operator_proposals;
CREATE POLICY delete_operator_proposals ON public.operator_proposals
  FOR DELETE TO service_role
  USING (true);

--------------------------------------------------------------------------------
-- RPCs
--------------------------------------------------------------------------------

-- Atomic claim-for-review semantics so multiple operator clients don't pick up
-- the same draft. Mirrors claim_platform_feed_items' SKIP LOCKED pattern.
CREATE OR REPLACE FUNCTION public.claim_operator_proposals_for_review(p_limit integer DEFAULT 25)
RETURNS SETOF public.operator_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT p.id
    FROM public.operator_proposals p
    WHERE p.status = 'queued'
      AND (p.expires_at IS NULL OR p.expires_at > now())
    ORDER BY p.cross_brand_count DESC, p.drafted_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.operator_proposals p
  SET status = 'in_review'
  FROM candidate c
  WHERE p.id = c.id
  RETURNING p.*;
END;
$$;

-- Operator decision RPC. Validates legal status transitions and writes the
-- review metadata atomically. Returns the updated row.
CREATE OR REPLACE FUNCTION public.decide_operator_proposal(
  p_proposal_id uuid,
  p_decision text,                  -- 'approved' | 'modified' | 'rejected'
  p_reviewer_id uuid,
  p_notes text DEFAULT NULL,
  p_modified_actions jsonb DEFAULT NULL
)
RETURNS public.operator_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operator_proposals;
BEGIN
  IF p_decision NOT IN ('approved', 'modified', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision: %', p_decision;
  END IF;

  IF p_decision = 'modified' AND p_modified_actions IS NULL THEN
    RAISE EXCEPTION 'modified decision requires p_modified_actions';
  END IF;

  UPDATE public.operator_proposals
  SET
    status = p_decision,
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = p_notes,
    modified_actions = CASE WHEN p_decision = 'modified' THEN p_modified_actions ELSE modified_actions END
  WHERE id = p_proposal_id
    AND status IN ('queued', 'in_review')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal % not found or not in a reviewable state', p_proposal_id;
  END IF;

  RETURN v_row;
END;
$$;

-- Background sweeper for stale proposals. Run from cron alongside
-- r2-signal-process. Idempotent.
CREATE OR REPLACE FUNCTION public.expire_stale_operator_proposals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.operator_proposals
  SET status = 'expired'
  WHERE status IN ('draft', 'queued', 'in_review')
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_operator_proposals_for_review(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_operator_proposals_for_review(integer) TO service_role;

REVOKE ALL ON FUNCTION public.decide_operator_proposal(uuid, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_operator_proposal(uuid, text, uuid, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expire_stale_operator_proposals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_operator_proposals() TO service_role;

COMMENT ON TABLE public.operator_proposals IS
  'Agent-drafted action proposals layered above platform_feed_items. See ADR-006.';
COMMENT ON COLUMN public.operator_proposals.triggering_signal_ids IS
  'platform_feed_items.id values that generated this proposal; first is primary trigger.';
COMMENT ON COLUMN public.operator_proposals.cross_brand_count IS
  'Distinct source_systems represented across triggering_signal_ids — proposals with >=2 are prioritized in claim_operator_proposals_for_review.';
