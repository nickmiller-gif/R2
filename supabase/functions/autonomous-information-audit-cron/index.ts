import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

function readBearer(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? (match[1] ?? null) : null;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-information-audit-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected =
      Deno.env.get('AUTONOMOUS_INFORMATION_AUDIT_CRON_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_NEWS_CRON_TOKEN')?.trim() ??
      '';
    if (expected.length > 0) {
      const supplied = readBearer(req) ?? '';
      if (!supplied || !timingSafeEqual(supplied, expected)) {
        return errorResponse('Unauthorized cron token', 401);
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    const serviceToken =
      Deno.env.get('INFORMATION_AUDIT_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim();
    if (!supabaseUrl || !serviceToken) {
      return errorResponse('SUPABASE_URL and audit service token must be configured', 500);
    }

    const hourBucket = new Date().toISOString().slice(0, 13);
    const idempotencyKey = `info-audit-cron:${hourBucket}`;

    const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-information-audit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ enrich_with_llm: true, auto_remediate: true, emit_when_clear: false }),
    });

    const body = await response.json().catch(() => ({ error: 'non-json response' }));
    if (!response.ok) {
      log.error('information_audit_cron_failed', { status: response.status, body });
      return errorResponse(
        `autonomous-information-audit failed (${response.status})`,
        response.status >= 500 ? 500 : 400,
      );
    }

    return jsonResponse({ ok: true, hour_bucket: hourBucket, audit: body }, 202);
  }),
);
