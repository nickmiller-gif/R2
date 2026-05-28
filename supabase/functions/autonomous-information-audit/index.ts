import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { extractBearerToken, guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import {
  appendRetrievalRunFindings,
  autoRemediateFindings,
  emitInformationAuditSignal,
  runDeterministicInformationAudit,
} from '../_shared/autonomous-information-audit.ts';
import { isAutonomousMeshPaused } from '../_shared/autonomous-revolutionary-mesh.ts';

function hasInternalServiceToken(req: Request): boolean {
  const configured =
    Deno.env.get('INFORMATION_AUDIT_SERVICE_TOKEN')?.trim() ??
    Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim() ??
    '';
  if (!configured) return false;
  const supplied = extractBearerToken(req)?.trim() ?? '';
  if (!supplied) return false;
  return timingSafeEqual(supplied, configured);
}

function parseBody(value: unknown): {
  enrich_with_llm: boolean;
  auto_remediate: boolean;
  emit_when_clear: boolean;
} {
  if (!value || typeof value !== 'object') {
    return { enrich_with_llm: true, auto_remediate: false, emit_when_clear: false };
  }
  const body = value as Record<string, unknown>;
  return {
    enrich_with_llm: body.enrich_with_llm !== false,
    auto_remediate: body.auto_remediate === true,
    emit_when_clear: body.emit_when_clear === true,
  };
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-information-audit');
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

    let options = { enrich_with_llm: true, auto_remediate: false, emit_when_clear: false };
    try {
      const raw = await req.text();
      if (raw.trim()) options = parseBody(JSON.parse(raw));
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    let audit;
    try {
      audit = await runDeterministicInformationAudit();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audit failed';
      return errorResponse(message, 500);
    }

    let findings = await appendRetrievalRunFindings(audit.findings);

    if (findings.length === 0 && !options.emit_when_clear) {
      return jsonResponse({
        ok: true,
        missing_count: 0,
        verified_count: audit.verified_count,
        checks_run: audit.checks_run,
        emitted: false,
        message:
          'All information checks passed; no signal emitted (set emit_when_clear to publish).',
      });
    }

    let remediation: Awaited<ReturnType<typeof autoRemediateFindings>> = [];
    if (options.auto_remediate) {
      remediation = await autoRemediateFindings(findings);
    }

    try {
      const emitted = await emitInformationAuditSignal({
        idempotencyKey,
        findings,
        checks_run: audit.checks_run,
        verified_count: audit.verified_count,
        enrich_with_llm: options.enrich_with_llm,
      });
      log.info('information_audit_emitted', {
        missing_count: findings.length,
        signal_id: emitted.signal_id,
        remediated: remediation.length,
      });
      return jsonResponse(
        {
          ok: true,
          missing_count: findings.length,
          verified_count: audit.verified_count,
          checks_run: audit.checks_run,
          findings,
          remediation,
          signal_id: emitted.signal_id,
          emitted_status: emitted.status,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signal emission failed';
      log.error('information_audit_emit_failed', { message });
      return errorResponse(message, 500);
    }
  }),
);
