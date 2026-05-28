import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

function tokenFromHeader(req: Request): string {
  return req.headers.get('x-cron-token')?.trim() ?? '';
}

function expectedToken(): string {
  return Deno.env.get('BOTOS_BOT_DRIVER_CRON_TOKEN')?.trim() ?? '';
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected = expectedToken();
    if (expected.length > 0 && tokenFromHeader(req) !== expected) {
      return errorResponse('Unauthorized cron token', 401);
    }

    return jsonResponse({
      ok: true,
      status: 'accepted',
      mode: 'compatibility_noop',
      message:
        'Legacy botos-bot-driver-cron endpoint acknowledged. Autonomous workloads run on current autonomous-* edges.',
      accepted_at: new Date().toISOString(),
    });
  }),
);
