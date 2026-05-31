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
    const log = withLogger(meta, 'autonomous-steward-cycle-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected =
      Deno.env.get('AUTONOMOUS_STEWARD_CRON_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_NEWS_CRON_TOKEN')?.trim() ??
      '';
    if (expected.length === 0) {
      return errorResponse(
        'AUTONOMOUS_STEWARD_CRON_TOKEN (or AUTONOMOUS_NEWS_CRON_TOKEN) must be configured',
        503,
      );
    }
    const supplied = readBearer(req) ?? '';
    if (!supplied || !timingSafeEqual(supplied, expected)) {
      return errorResponse('Unauthorized cron token', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    const serviceToken =
      Deno.env.get('STEWARD_CYCLE_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim();
    if (!supabaseUrl || !serviceToken) {
      return errorResponse('SUPABASE_URL and steward service token must be configured', 500);
    }

    const dayBucket = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `steward-cron:${dayBucket}`;

    const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-steward-cycle`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        enrich_with_llm: Deno.env.get('STEWARD_LLM_ENRICH') === 'true',
        skip_pre_audit: false,
        emit_when_empty: false,
      }),
    });

    const body = await response.json().catch(() => ({ error: 'non-json response' }));
    if (!response.ok) {
      log.error('steward_cron_failed', { status: response.status, body });
      return errorResponse(
        `autonomous-steward-cycle failed (${response.status})`,
        response.status >= 500 ? 500 : 400,
      );
    }

    return jsonResponse({ ok: true, day_bucket: dayBucket, steward: body }, 202);
  }),
);
