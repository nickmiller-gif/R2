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

/** Skip empty env values so a blank custom secret does not block fallbacks. */
function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * Token for the cron → eigen-memory-episodes consolidate hop.
 * Vault/pg_cron often stores the service-role JWT as the cron bearer; reuse it
 * when no dedicated service token is configured.
 */
function resolveConsolidateServiceToken(validatedCronBearer: string): string {
  return firstNonEmpty(
    Deno.env.get('EIGEN_MEMORY_EPISODES_SERVICE_TOKEN'),
    validatedCronBearer,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );
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
    const serviceToken = resolveConsolidateServiceToken(supplied);
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
      const hint =
        response.status === 401
          ? ' Check EIGEN_MEMORY_EPISODES_SERVICE_TOKEN is a valid service_role JWT, or remove it to use SUPABASE_SERVICE_ROLE_KEY / the cron bearer.'
          : '';
      return errorResponse(
        `eigen-memory-episodes failed (${response.status}).${hint}`,
        response.status >= 500 ? 500 : 400,
      );
    }

    return jsonResponse({ ok: true, day_bucket: dayBucket, consolidation: body }, 202);
  }),
);
