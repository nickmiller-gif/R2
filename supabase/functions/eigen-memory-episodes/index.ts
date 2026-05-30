/**
 * Memory episode read + consolidate (E3).
 * Consolidate requires service_role JWT (cron / ops).
 */
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { consolidateMemoryEpisodes } from '../_shared/memory-episode-consolidate.ts';
import { isValidMegEntityId } from '../../../src/lib/eigen/chat-entity-context.ts';
import {
  isValidEpisodeTopicKey,
  MAX_EPISODE_TOPIC_KEY_CHARS,
  parseBoundedConsolidateInt,
} from '../../../src/lib/eigen/memory-episode-keys.ts';

const ALLOWED_SCOPES = new Set(['session', 'user', 'workspace']);

function parseEpisodeListLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '20', 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(parsed, 100));
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const client = getServiceClient();
    const isServiceRole = auth.claims.role === 'service_role';

    try {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (req.method === 'GET') {
        if (!isServiceRole) {
          const roleCheck = await requireRole(auth.claims.userId, 'member');
          if (!roleCheck.ok) return roleCheck.response;
        }

        const scope = url.searchParams.get('scope');
        const topicKey = url.searchParams.get('topic_key');
        const sessionId = url.searchParams.get('session_id');
        const limit = parseEpisodeListLimit(url.searchParams.get('limit'));

        if (scope && !ALLOWED_SCOPES.has(scope)) {
          return errorResponse('Invalid scope filter', 400);
        }
        if (topicKey) {
          if (topicKey.length > MAX_EPISODE_TOPIC_KEY_CHARS) {
            return errorResponse('topic_key too long', 400);
          }
          if (!isValidEpisodeTopicKey(topicKey)) {
            return errorResponse('Invalid topic_key format', 400);
          }
        }
        if (sessionId && !isValidMegEntityId(sessionId)) {
          return errorResponse('Invalid session_id', 400);
        }

        let query = client
          .from('memory_episodes')
          .select(
            'created_at,entity_ids,id,owner_id,scope,session_id,source_entry_ids,source_turn_ids,summary,topic_key,turn_count,updated_at,window_end,window_start',
          )
          .order('window_end', { ascending: false })
          .limit(limit);

        if (!isServiceRole) query = query.eq('owner_id', auth.claims.userId);
        if (scope) query = query.eq('scope', scope);
        if (topicKey) query = query.eq('topic_key', topicKey);
        if (sessionId) query = query.eq('session_id', sessionId);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ episodes: data ?? [] });
      }

      if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
      if (!isServiceRole) {
        return errorResponse('Service role JWT required for consolidate', 403);
      }

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await req.json().catch(() => ({}));
      const resolvedAction =
        action ?? (typeof body.action === 'string' ? body.action : 'consolidate');

      if (resolvedAction === 'consolidate') {
        const result = await consolidateMemoryEpisodes(client, {
          lookbackDays: parseBoundedConsolidateInt(body.lookback_days, 14, 1, 90),
          maxSessions: parseBoundedConsolidateInt(body.max_sessions, 200, 1, 1000),
        });

        return jsonResponse({ action: 'consolidate', ...result }, 202);
      }

      return errorResponse(`Unknown action: ${resolvedAction}`, 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
