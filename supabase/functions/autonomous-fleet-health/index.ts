import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { fetchAgentActivity } from '../_shared/autonomous-regent-review.ts';
import {
  assessFleetHealth,
  emitFleetHealthSignal,
  fetchFleetFailureCounts,
} from '../_shared/autonomous-fleet-health.ts';

/**
 * autonomous-fleet-health — the fleet watchdog. Classifies every autonomous bot
 * active/quiet/silent, flags expected bots that have gone missing, and alerts on
 * failed/deadlettered signals. Emits one advisory fleet_health_report. Runs even
 * when the mesh is paused (a paused mesh is exactly when you want the report).
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

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-fleet-health');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    if (!hasInternalServiceToken(req)) {
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const isServiceRole = auth.claims.role === 'service_role';
      if (!isServiceRole) {
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
      }
    }

    const idempotencyKey =
      req.headers.get('x-idempotency-key')?.trim() ??
      `fleet-health:${new Date().toISOString().slice(0, 13)}`;

    let report;
    try {
      const client = getServiceClient();
      // Include REGENT itself — the watchdog must confirm REGENT is running.
      const bots = await fetchAgentActivity(client, { excludeBot: null });
      const failures = await fetchFleetFailureCounts(client);
      report = assessFleetHealth({
        bots,
        failedSignals: failures.failedSignals,
        deadletterBacklog: failures.deadletterBacklog,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fleet assessment failed';
      log.error('fleet_health_failed', { message });
      return errorResponse(message, 500);
    }

    try {
      const emitted = await emitFleetHealthSignal({ idempotencyKey, report });
      log.info('fleet_health_emitted', {
        healthy: report.healthy,
        alerts: report.alerts.length,
        signal_id: emitted.signal_id,
      });
      return jsonResponse(
        {
          ok: true,
          healthy: report.healthy,
          alerts: report.alerts,
          bots: report.bots,
          signal_id: emitted.signal_id,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signal emission failed';
      log.error('fleet_health_emit_failed', { message });
      return errorResponse(message, 500);
    }
  }),
);
