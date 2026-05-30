import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

/**
 * Weekly trigger for the REGENT Paralegal scheduling bot. Calls
 * autonomous-paralegal-schedule with no body (live Eigen-derived world-state).
 */

function readBearer(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? (match[1] ?? null) : null;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-paralegal-schedule-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected =
      Deno.env.get('AUTONOMOUS_PARALEGAL_SCHEDULE_CRON_TOKEN')?.trim() ??
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
      Deno.env.get('REGENT_REVIEW_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('INFORMATION_AUDIT_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim();
    if (!supabaseUrl || !serviceToken) {
      return errorResponse('SUPABASE_URL and a service token must be configured', 500);
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const week = Math.ceil(((now.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
    const idempotencyKey = `paralegal-cron:${year}-W${week}`;

    const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-paralegal-schedule`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({}),
    });

    const body = await response.json().catch(() => ({ error: 'non-json response' }));
    if (!response.ok) {
      log.error('paralegal_cron_failed', { status: response.status, body });
      return errorResponse(
        `autonomous-paralegal-schedule failed (${response.status})`,
        response.status >= 500 ? 500 : 400,
      );
    }

    return jsonResponse({ ok: true, week_bucket: idempotencyKey, schedule: body }, 202);
  }),
);
