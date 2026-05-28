import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { listConfiguredDrivers } from '../_shared/autonomous-scout-drivers.ts';
import {
  emitRevolutionaryMeshSignal,
  fetchRecentKbSignals,
  isAutonomousMeshPaused,
  synthesizeRevolutionaryPatterns,
  triggerRssCronForMesh,
  type RecentKbSignal,
} from '../_shared/autonomous-revolutionary-mesh.ts';

function hasInternalServiceToken(req: Request): boolean {
  const configured =
    Deno.env.get('REVOLUTIONARY_MESH_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ??
    '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  if (!supplied) return false;
  return timingSafeEqual(supplied, configured);
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-revolutionary-mesh');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const trustedInternal = hasInternalServiceToken(req);
    if (!trustedInternal) {
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
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

    const hourBucket = new Date().toISOString().slice(0, 13);
    const drivers = listConfiguredDrivers();

    let driverResults: Record<string, unknown>[] = [];
    let driverErrors: Array<{ driver: string; error: string }> = [];
    try {
      const cron = await triggerRssCronForMesh(drivers, hourBucket);
      driverResults = cron.results;
      driverErrors = cron.errors;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'RSS cron phase failed';
      log.error('revolutionary_mesh_cron_failed', { message });
      return errorResponse(message, 500);
    }

    if (driverResults.length === 0 && driverErrors.length > 0) {
      return errorResponse(driverErrors[0]?.error ?? 'All drivers failed', 500);
    }

    let recentSignals: RecentKbSignal[] = [];
    try {
      recentSignals = await fetchRecentKbSignals(72, 48);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recent signals';
      return errorResponse(message, 500);
    }

    let patterns;
    try {
      patterns = await synthesizeRevolutionaryPatterns({ driverResults, recentSignals });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pattern synthesis failed';
      log.error('revolutionary_mesh_synthesis_failed', { message });
      return errorResponse(message, 500);
    }

    try {
      const emitted = await emitRevolutionaryMeshSignal({
        idempotencyKey,
        patterns,
        driverResults,
        recentSignalCount: recentSignals.length,
        triggeredBy: trustedInternal ? 'service' : 'operator',
      });
      log.info('revolutionary_mesh_emitted', {
        patterns: patterns.length,
        signal_id: emitted.signal_id,
        driver_errors: driverErrors.length,
      });
      return jsonResponse(
        {
          ok: true,
          hour_bucket: hourBucket,
          drivers_requested: drivers,
          driver_results: driverResults,
          driver_errors: driverErrors,
          patterns,
          recent_signal_count: recentSignals.length,
          signal_id: emitted.signal_id,
          emitted_status: emitted.status,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mesh signal emission failed';
      log.error('revolutionary_mesh_emit_failed', { message });
      return errorResponse(message, 500);
    }
  }),
);
