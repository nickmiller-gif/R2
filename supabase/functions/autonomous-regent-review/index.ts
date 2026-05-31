import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { isAutonomousMeshPaused } from '../_shared/autonomous-revolutionary-mesh.ts';
import {
  applyFinancials,
  buildExecutiveTeam,
  buildLiveWorldStateFromDb,
  emitRegentReviewSignal,
  fetchAgentActivity,
  fetchPreviousRegentReview,
  loadRegentFinancials,
  type WorldState,
} from '../_shared/autonomous-regent-review.ts';

/**
 * REGENT — autonomous executive review bot.
 *
 * Reads R2's world-state (supplied in the request body by the local
 * `regent-publish-world-state` bridge, or derived live from the Eigen feed when
 * none is given), applies the codified MBA method, and emits ONE advisory signal:
 * a ranked agenda of the executive decisions that matter this week, each with
 * full provenance. Advisory only — the sole side effect is inserting a feed item.
 */

function hasInternalServiceToken(req: Request): boolean {
  const configured =
    Deno.env.get('REGENT_REVIEW_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('INFORMATION_AUDIT_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ??
    '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  if (!supplied) return false;
  return timingSafeEqual(supplied, configured);
}

function isWorldState(value: unknown): value is WorldState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.cost_of_capital_pct === 'number' &&
    typeof v.treasury === 'object' &&
    v.treasury !== null &&
    Array.isArray(v.domains)
  );
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-regent-review');
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

    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
    if (!idempotencyKey) return errorResponse('Missing x-idempotency-key', 400);

    const runtime = await isAutonomousMeshPaused();
    if (runtime.paused) {
      return errorResponse(
        `Autonomous mesh is paused: ${runtime.reason ?? 'no reason recorded'}`,
        409,
      );
    }

    // World-state: prefer a supplied state (cross-repo asset + financial review
    // from the local bridge); otherwise derive a live read from the Eigen feed.
    let state: WorldState;
    let stateSource: 'supplied' | 'live_db';
    try {
      const raw = await req.text();
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as { world_state?: unknown } | unknown;
        const candidate =
          parsed && typeof parsed === 'object' && 'world_state' in parsed
            ? (parsed as { world_state: unknown }).world_state
            : parsed;
        if (isWorldState(candidate)) {
          state = candidate;
          stateSource = 'supplied';
        } else {
          state = await buildLiveWorldStateFromDb(getServiceClient());
          stateSource = 'live_db';
        }
      } else {
        state = await buildLiveWorldStateFromDb(getServiceClient());
        stateSource = 'live_db';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assemble world-state';
      log.error('regent_review_state_failed', { message });
      return errorResponse(message, 500);
    }

    // Chief of Staff input: reconcile the rest of the bot fleet. Both state
    // paths get this, since orchestration is inherently a live concern.
    try {
      state.agent_activity = await fetchAgentActivity(getServiceClient());
    } catch (err) {
      log.error('regent_agent_activity_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      // Non-fatal: the Chief of Staff simply has no fleet to reconcile.
    }

    // Overlay principal-attested financials (single source of truth). Empty →
    // financials stay unsourced and the Capital/Commercial faculties name the gap.
    try {
      state = applyFinancials(state, await loadRegentFinancials(getServiceClient()));
    } catch (err) {
      log.error('regent_financials_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // Institutional memory: diff + outcome ages against last week's review.
    let prev: {
      agenda: import('../_shared/autonomous-regent-review.ts').PriorAgendaItem[];
      ages: Record<string, number>;
    } | null = null;
    try {
      prev = await fetchPreviousRegentReview(getServiceClient());
    } catch {
      // Non-fatal: first run has no prior review.
    }

    let review;
    try {
      review = buildExecutiveTeam(state, 5, prev?.agenda ?? null, prev?.ages ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review failed';
      log.error('regent_review_failed', { message });
      return errorResponse(message, 500);
    }

    try {
      const emitted = await emitRegentReviewSignal({ idempotencyKey, review, state });
      log.info('regent_review_emitted', {
        state_source: stateSource,
        agenda: review.agenda.length,
        deferred: review.deferred.length,
        signal_id: emitted.signal_id,
      });
      return jsonResponse(
        {
          ok: true,
          state_source: stateSource,
          agenda_count: review.agenda.length,
          deferred_count: review.deferred.length,
          stale_domains: review.staleDomains,
          agenda: review.agenda,
          executive_team: review.roles,
          tensions: review.tensions,
          chief_of_staff: review.chief_of_staff,
          delta: review.delta,
          outcomes: review.outcomes,
          counsel_queue: review.counsel_queue,
          signal_id: emitted.signal_id,
          emitted_status: emitted.status,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signal emission failed';
      log.error('regent_review_emit_failed', { message });
      return errorResponse(message, 500);
    }
  }),
);
