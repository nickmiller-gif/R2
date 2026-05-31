-- REGENT financial inputs (P0 — light up the Capital/Commercial/Operations faculties).
--
-- Real treasury cash, per-domain economics, cost-of-capital, and funding-gate
-- state are principal-attested figures that live in no connected system here
-- (QuickBooks is not wired). This table is the authoritative source: the
-- autonomous bot reads the latest row each run. EMPTY means UNSOURCED -- the
-- faculties stay on HOLD and the gap is named, never fabricated (invariant #2).
-- Populated rows are the principal's attested numbers.
--
-- Append-only by convention (each row is a dated snapshot); the bot reads the
-- most recent by updated_at. Operators/counsel/admin may read and write;
-- service_role (the bot) has full access.

CREATE TABLE IF NOT EXISTS public.regent_world_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of date NOT NULL DEFAULT current_date,
  cash_on_hand numeric,
  cost_of_capital_pct numeric CHECK (cost_of_capital_pct IS NULL OR cost_of_capital_pct >= 0),
  runway_floor_months numeric CHECK (runway_floor_months IS NULL OR runway_floor_months >= 0),
  -- [{ key, ttm_revenue, ttm_direct_cost, invested_capital, monthly_burn, data_freshness_days }]
  domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ source, amount, expected_date, probability_pct }]
  committed_inflows jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- optional override of funding phase / gate_cleared / dates
  funding jsonb,
  source text,
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regent_world_state_updated_at_idx
  ON public.regent_world_state (updated_at DESC);

ALTER TABLE public.regent_world_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_regent_world_state ON public.regent_world_state;
CREATE POLICY select_regent_world_state
  ON public.regent_world_state
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

-- Operators/counsel/admin may record figures; service_role (bot/seed) full access.
DROP POLICY IF EXISTS write_regent_world_state_privileged ON public.regent_world_state;
CREATE POLICY write_regent_world_state_privileged
  ON public.regent_world_state
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.charter_user_roles cur
      WHERE cur.user_id = (SELECT auth.uid())
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS write_regent_world_state_service ON public.regent_world_state;
CREATE POLICY write_regent_world_state_service
  ON public.regent_world_state
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- No seed row: an empty table is the correct "financials unsourced" state.
