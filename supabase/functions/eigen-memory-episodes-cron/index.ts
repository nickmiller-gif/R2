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
    const log = withLogger(meta, 'eigen-memory-episodes-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected = Deno.env.get('EIGEN_MEMORY_EPISODES_CRON_TOKEN')?.trim() ?? '';
    if (expected.length === 0) {
      return errorResponse('EIGEN_MEMORY_EPISODES_CRON_TOKEN must be configured', 503);
    }
    const supplied = readBearer(req) ?? '';
    if (!supplied || !timingSafeEqual(supplied, expected)) {
      return errorResponse('Unauthorized cron token', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    const serviceToken =
      Deno.env.get('EIGEN_MEMORY_EPISODES_SERVICE_TOKEN')?.trim() ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    if (!supabaseUrl || !serviceToken) {
      return errorResponse('SUPABASE_URL and service token must be configured', 500);
    }

    const dayBucket = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `memory-episodes-cron:${dayBucket}`;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/eigen-memory-episodes?action=consolidate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ action: 'consolidate' }),
      },
    );

    const body = await response.json().catch(() => ({ error: 'non-json response' }));
    if (!response.ok) {
      log.error('memory_episodes_cron_failed', { status: response.status, body });
      return errorResponse(
        `eigen-memory-episodes failed (${response.status})`,
        response.status >= 500 ? 500 : 400,
      );
    }

    return jsonResponse({ ok: true, day_bucket: dayBucket, consolidation: body }, 202);
  }),
);
