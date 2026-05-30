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
  buildLiveWorldStateFromDb,
  fetchAgentActivity,
  type WorldState,
} from '../_shared/autonomous-regent-review.ts';
import {
  buildParalegalSchedule,
  emitParalegalScheduleSignal,
} from '../_shared/autonomous-paralegal-schedule.ts';

/**
 * REGENT Paralegal — autonomous scheduling bot. Staff to the General Counsel
 * and Chief of Staff: maintains the calendar of recurring obligations and
 * deadlines (regulatory reviews, funding-gate checkpoints, cost-of-capital
 * revisit, committed-inflow dates, weekly exec review, fleet-health review) and
 * emits one advisory schedule signal. Reviews a supplied world-state or a live
 * Eigen-derived one. Advisory only — it proposes a schedule; it books nothing.
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
  return typeof v.treasury === 'object' && v.treasury !== null && Array.isArray(v.domains);
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-paralegal-schedule');
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

    let state: WorldState;
    try {
      const raw = await req.text();
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as { world_state?: unknown } | unknown;
        const candidate =
          parsed && typeof parsed === 'object' && 'world_state' in parsed
            ? (parsed as { world_state: unknown }).world_state
            : parsed;
        state = isWorldState(candidate)
          ? candidate
          : await buildLiveWorldStateFromDb(getServiceClient());
      } else {
        state = await buildLiveWorldStateFromDb(getServiceClient());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assemble world-state';
      log.error('paralegal_state_failed', { message });
      return errorResponse(message, 500);
    }

    try {
      state.agent_activity = await fetchAgentActivity(getServiceClient());
    } catch {
      // Non-fatal — fleet-health review item is simply omitted.
    }

    const schedule = buildParalegalSchedule(state);

    try {
      const emitted = await emitParalegalScheduleSignal({ idempotencyKey, schedule });
      log.info('paralegal_schedule_emitted', {
        items: schedule.items.length,
        overdue: schedule.overdue,
        due_soon: schedule.due_soon,
        signal_id: emitted.signal_id,
      });
      return jsonResponse(
        {
          ok: true,
          as_of: schedule.as_of,
          counts: {
            overdue: schedule.overdue,
            due_soon: schedule.due_soon,
            upcoming: schedule.upcoming,
          },
          schedule: schedule.items,
          signal_id: emitted.signal_id,
          emitted_status: emitted.status,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signal emission failed';
      log.error('paralegal_emit_failed', { message });
      return errorResponse(message, 500);
    }
  }),
);
