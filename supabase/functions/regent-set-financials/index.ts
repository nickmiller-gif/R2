import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';

/**
 * regent-set-financials — record principal-attested financial inputs into
 * regent_world_state. REGENT's bots read the latest row each run, so this is the
 * write side of the financial feed. Accepts attested figures only — it writes
 * exactly what it is given and never invents numbers.
 *
 * Auth: a dedicated REGENT_FINANCIALS_INGEST_TOKEN (preferred, for the
 * Tower→Eigen accounting bridge) or any existing bot service token; otherwise a
 * signed-in operator. Source-of-truth callers:
 *   - CentralR2 accounting-regent-bridge (weekly net-worth snapshot)
 *   - scripts/regent-set-financials.mjs (manual)
 */

type DomainFin = {
  key: string;
  ttm_revenue?: number;
  ttm_direct_cost?: number;
  invested_capital?: number;
  monthly_burn?: number;
  data_freshness_days?: number;
  offers?: unknown[];
  funnel?: unknown[];
};

type Body = {
  as_of?: string;
  cash_on_hand?: number | null;
  cost_of_capital_pct?: number | null;
  runway_floor_months?: number | null;
  domains?: DomainFin[];
  committed_inflows?: Record<string, unknown>[];
  funding?: Record<string, unknown> | null;
  source?: string;
  note?: string;
};

function hasInternalServiceToken(req: Request): boolean {
  const configured =
    Deno.env.get('REGENT_FINANCIALS_INGEST_TOKEN')?.trim() ??
    Deno.env.get('REGENT_REVIEW_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('INFORMATION_AUDIT_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ??
    '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  if (!supplied) return false;
  return timingSafeEqual(supplied, configured);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'regent-set-financials');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const trustedInternal = hasInternalServiceToken(req);
    if (!trustedInternal) {
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const isServiceRole = auth.claims.role === 'service_role';
      if (!isServiceRole) {
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
      }
    }

    let body: Body;
    try {
      const raw = await req.text();
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if (!isObj(parsed)) return errorResponse('Body must be a JSON object', 400);
      body = parsed as Body;
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    const row = {
      as_of: typeof body.as_of === 'string' ? body.as_of.slice(0, 10) : today,
      cash_on_hand: numOrNull(body.cash_on_hand),
      cost_of_capital_pct: numOrNull(body.cost_of_capital_pct),
      runway_floor_months: numOrNull(body.runway_floor_months),
      domains: Array.isArray(body.domains) ? body.domains : [],
      committed_inflows: Array.isArray(body.committed_inflows) ? body.committed_inflows : [],
      funding: isObj(body.funding) ? body.funding : null,
      source: typeof body.source === 'string' ? body.source.slice(0, 120) : 'api',
      note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
    };

    const client =
      getServiceClient() as import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient<any>;
    const { data, error } = await client
      .from('regent_world_state')
      .insert(row)
      .select('id,as_of,source')
      .single();

    if (error) {
      log.error('regent_financials_insert_failed', { message: error.message });
      return errorResponse(error.message, 500);
    }

    log.info('regent_financials_recorded', { id: data?.id, as_of: row.as_of, source: row.source });
    return jsonResponse({ ok: true, id: data?.id, as_of: data?.as_of, source: data?.source }, 201);
  }),
);
