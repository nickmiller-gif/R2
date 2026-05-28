import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { isAutonomousMeshPaused } from '../_shared/autonomous-revolutionary-mesh.ts';
import {
  emitStewardBriefSignals,
  fetchInfrastructureGapsViaAudit,
  runStewardCycle,
} from '../_shared/autonomous-steward-cycle.ts';

function hasInternalServiceToken(req: Request): boolean {
  const configured =
    Deno.env.get('STEWARD_CYCLE_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ??
    '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  if (!supplied) return false;
  return timingSafeEqual(supplied, configured);
}

function parseBody(value: unknown): {
  enrich_with_llm: boolean;
  skip_pre_audit: boolean;
  emit_when_empty: boolean;
  auto_remediate: boolean;
} {
  if (!value || typeof value !== 'object') {
    return {
      enrich_with_llm: false,
      skip_pre_audit: false,
      emit_when_empty: false,
      auto_remediate: false,
    };
  }
  const body = value as Record<string, unknown>;
  return {
    enrich_with_llm: body.enrich_with_llm === true,
    skip_pre_audit: body.skip_pre_audit === true,
    emit_when_empty: body.emit_when_empty === true,
    auto_remediate: body.auto_remediate === true,
  };
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-steward-cycle');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const trustedInternal = hasInternalServiceToken(req);
    const auditServiceToken =
      Deno.env.get('STEWARD_CYCLE_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ??
      '';
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

    let options = {
      enrich_with_llm: false,
      skip_pre_audit: false,
      emit_when_empty: false,
      auto_remediate: false,
    };
    try {
      const raw = await req.text();
      if (raw.trim()) options = parseBody(JSON.parse(raw));
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    let infrastructure_gaps: Awaited<ReturnType<typeof fetchInfrastructureGapsViaAudit>> = [];
    if (!options.skip_pre_audit && auditServiceToken) {
      try {
        infrastructure_gaps = await fetchInfrastructureGapsViaAudit(auditServiceToken);
      } catch (err) {
        log.error('steward_pre_audit_failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let cycle;
    try {
      cycle = await runStewardCycle({
        infrastructure_gaps,
        enrich_with_llm: options.enrich_with_llm,
        skip_portfolio_audit: infrastructure_gaps.length > 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Steward cycle failed';
      return errorResponse(message, 500);
    }

    if (cycle.patterns.length === 0 && !options.emit_when_empty) {
      return jsonResponse({
        ok: true,
        pattern_count: 0,
        infrastructure_gaps: cycle.infrastructure_gaps,
        checks_run: cycle.checks_run,
        auto_remediations: options.auto_remediate ? (cycle.auto_remediations ?? []) : [],
        emitted: false,
        message:
          'No cross-domain patterns with 3+ KB drivers in the lookback window. Set emit_when_empty to force a signal.',
      });
    }

    try {
      const emitted = await emitStewardBriefSignals({
        idempotencyKey,
        patterns: cycle.patterns,
        infrastructure_gaps: cycle.infrastructure_gaps,
      });
      log.info('steward_cycle_emitted', {
        patterns: cycle.patterns.length,
        signals: emitted.length,
      });
      return jsonResponse(
        {
          ok: true,
          pattern_count: cycle.patterns.length,
          patterns: cycle.patterns,
          infrastructure_gaps: cycle.infrastructure_gaps,
          checks_run: cycle.checks_run,
          auto_remediations: options.auto_remediate ? (cycle.auto_remediations ?? []) : [],
          emitted,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Steward emit failed';
      log.error('steward_emit_failed', { message });
      return errorResponse(message, 500);
    }
  }),
);
