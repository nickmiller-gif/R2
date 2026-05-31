import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

/** Daily trigger for the fleet-health watchdog. */
function readBearer(req: Request): string | null {
  const v = req.headers.get('authorization');
  if (!v) return null;
  const m = /^Bearer\s+(.+)$/i.exec(v);
  return m ? (m[1] ?? null) : null;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-fleet-health-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected =
      Deno.env.get('AUTONOMOUS_FLEET_HEALTH_CRON_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_NEWS_CRON_TOKEN')?.trim() ??
      '';
    if (expected.length === 0) {
      return errorResponse(
        'AUTONOMOUS_FLEET_HEALTH_CRON_TOKEN (or AUTONOMOUS_NEWS_CRON_TOKEN) must be configured',
        503,
      );
    }
    const supplied = readBearer(req) ?? '';
    if (!supplied || !timingSafeEqual(supplied, expected)) {
      return errorResponse('Unauthorized cron token', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    const serviceToken =
      Deno.env.get('REGENT_REVIEW_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('INFORMATION_AUDIT_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim();
    if (!supabaseUrl || !serviceToken) {
      return errorResponse('SUPABASE_URL and a service token must be configured', 500);
    }

    const dayBucket = new Date().toISOString().slice(0, 10);
    const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-fleet-health`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': `fleet-health-cron:${dayBucket}`,
      },
      body: JSON.stringify({}),
    });
    const body = await response.json().catch(() => ({ error: 'non-json response' }));
    if (!response.ok) {
      log.error('fleet_health_cron_failed', { status: response.status, body });
      return errorResponse(
        `autonomous-fleet-health failed (${response.status})`,
        response.status >= 500 ? 500 : 400,
      );
    }
    return jsonResponse({ ok: true, day_bucket: dayBucket, health: body }, 202);
  }),
);
