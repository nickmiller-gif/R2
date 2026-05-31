import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

/**
 * Daily trigger for the REGENT executive review. Calls
 * autonomous-regent-review with no body, so it reviews the live Eigen-derived
 * world-state. The richer cross-repo asset review is driven separately by the
 * local `regent-publish-world-state` bridge, which supplies a full world-state.
 */

function readBearer(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? (match[1] ?? null) : null;
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-regent-review-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected =
      Deno.env.get('AUTONOMOUS_REGENT_REVIEW_CRON_TOKEN')?.trim() ??
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
      return errorResponse('SUPABASE_URL and a REGENT service token must be configured', 500);
    }

    // Daily cadence: bucket by UTC date so a re-trigger inside the same day is
    // idempotent at the feed layer, but each new day emits a fresh review.
    const dayBucket = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const idempotencyKey = `regent-review-cron:${dayBucket}`;

    const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-regent-review`, {
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
      log.error('regent_review_cron_failed', { status: response.status, body });
      return errorResponse(
        `autonomous-regent-review failed (${response.status})`,
        response.status >= 500 ? 500 : 400,
      );
    }

    return jsonResponse({ ok: true, day_bucket: idempotencyKey, review: body }, 202);
  }),
);
