/**
 * Deadletter helper for `platform_feed_items`: manual replay via RPC.
 * Schedule/alerts land in Phase 6 operator UI; this edge route is the service hook.
 *
 * Gateway: `supabase/config.toml` sets `verify_jwt = false`; auth matches `r2-signal-process`.
 */
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';

function resolveTrustedProcessCaller(req: Request): boolean {
  const configured = Deno.env.get('R2_SIGNAL_PROCESS_TOKEN')?.trim();
  if (!configured) return false;
  const provided = req.headers.get('x-r2-signal-process-token')?.trim();
  return Boolean(provided && provided === configured);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'r2-signal-process-deadletter');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    if (!resolveTrustedProcessCaller(req)) {
      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const rawId = body['signal_id'];
    if (typeof rawId !== 'string' || !isUuid(rawId)) {
      return errorResponse('Body must include signal_id (uuid)', 400);
    }

    const client = getServiceClient();
    const rpc = await client.rpc('replay_platform_feed_item', {
      p_feed_item_id: rawId,
    });
    if (rpc.error) {
      log.error('deadletter_replay_failed', {
        event: 'deadletter_replay_failed',
        signal_id: rawId,
        message: rpc.error.message,
      });
      return errorResponse(rpc.error.message, 500);
    }

    log.info('deadletter_replay_ok', { event: 'deadletter_replay_ok', signal_id: rawId });
    return jsonResponse({ ok: true, signal_id: rawId });
  }),
);
