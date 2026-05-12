import {
  reflectedCorsHeaders,
  reflectedCorsResponse,
  reflectedErrorResponse,
  reflectedJsonResponse,
} from '../_shared/cors.ts';
import { IDEMPOTENCY_KEY_HEADER, withRequestMeta } from '../_shared/correlation.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { enforceEigenPublicRateLimit } from '../_shared/public-rate-limit.ts';

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '').toLowerCase();
}

/** Origins allowed to POST (browser). Extend via R2COMMUNITY_ACCESS_EXTRA_ORIGINS (comma-separated). */
function loadAllowedOrigins(): Set<string> {
  const set = new Set<string>([
    'https://r2community.com',
    'https://www.r2community.com',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
  ]);
  const extra = Deno.env.get('R2COMMUNITY_ACCESS_EXTRA_ORIGINS')?.split(',') ?? [];
  for (const raw of extra) {
    const t = raw.trim();
    if (t.length > 0) set.add(normalizeOrigin(t));
  }
  return set;
}

function isAllowedOrigin(origin: string, allow: Set<string>): boolean {
  const n = normalizeOrigin(origin);
  if (allow.has(n)) return true;
  // Lovable preview hosts
  try {
    const host = new URL(n).hostname;
    if (host.endsWith('.lovable.app')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function forbiddenOriginResponse(): Response {
  return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface AccessRequestBody {
  name: string;
  email: string;
  organization?: string;
  pathway: string;
  domain?: string;
  message?: string;
  source?: string;
}

class AccessRequestValidationError extends Error {
  readonly status = 400;
}

function parseBody(value: unknown): AccessRequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AccessRequestValidationError('Request body must be a JSON object');
  }
  const body = value as Record<string, unknown>;
  if (typeof body.name !== 'string' || body.name.trim().length < 1)
    throw new AccessRequestValidationError('Missing required field: name');
  if (typeof body.email !== 'string' || body.email.trim().length < 3)
    throw new AccessRequestValidationError('Missing required field: email');
  if (typeof body.pathway !== 'string' || body.pathway.trim().length < 1) {
    throw new AccessRequestValidationError('Missing required field: pathway');
  }
  const email = body.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccessRequestValidationError('Field email is invalid');
  }

  return {
    name: body.name.trim().slice(0, 240),
    email: email.slice(0, 320),
    organization:
      typeof body.organization === 'string' ? body.organization.trim().slice(0, 500) : undefined,
    pathway: body.pathway.trim().slice(0, 120),
    domain: typeof body.domain === 'string' ? body.domain.trim().slice(0, 200) : undefined,
    message: typeof body.message === 'string' ? body.message.trim().slice(0, 8000) : undefined,
    source:
      typeof body.source === 'string' && body.source.trim().length > 0
        ? body.source.trim().slice(0, 120)
        : 'r2community_request_access',
  };
}

const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

Deno.serve(
  withRequestMeta(async (req, _meta) => {
    const rawOrigin = req.headers.get('origin');
    const allowed = loadAllowedOrigins();

    if (req.method === 'OPTIONS') {
      if (!rawOrigin || !isAllowedOrigin(rawOrigin, allowed)) {
        return forbiddenOriginResponse();
      }
      return reflectedCorsResponse(rawOrigin);
    }

    if (rawOrigin && !isAllowedOrigin(rawOrigin, allowed)) {
      return forbiddenOriginResponse();
    }

    if (req.method !== 'POST') return reflectedErrorResponse(rawOrigin, 'Method not allowed', 405);

    if (!rawOrigin || !isAllowedOrigin(rawOrigin, allowed)) {
      return forbiddenOriginResponse();
    }

    try {
      const idempotencyKey = _meta.idempotencyKey;
      if (!idempotencyKey || idempotencyKey.trim().length === 0) {
        return reflectedErrorResponse(
          rawOrigin,
          `Missing required header: ${IDEMPOTENCY_KEY_HEADER}`,
          400,
        );
      }
      if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
        return reflectedErrorResponse(
          rawOrigin,
          `${IDEMPOTENCY_KEY_HEADER} must be <= ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
          400,
        );
      }

      let json: unknown;
      try {
        json = await req.json();
      } catch {
        return reflectedErrorResponse(rawOrigin, 'Invalid JSON body', 400);
      }

      const parsed = parseBody(json);
      const client = getServiceClient();
      const rl = await enforceEigenPublicRateLimit(client, req);
      if (!rl.ok) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retry_after_sec: rl.retryAfterSec }),
          {
            status: 429,
            headers: {
              ...reflectedCorsHeaders(rawOrigin),
              'Content-Type': 'application/json',
              'Retry-After': String(rl.retryAfterSec),
            },
          },
        );
      }

      const { data: existing } = await client
        .from('access_requests')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existing && (existing as { id?: string }).id) {
        return reflectedJsonResponse(rawOrigin, { ok: true, id: (existing as { id: string }).id });
      }

      const row = {
        idempotency_key: idempotencyKey,
        name: parsed.name,
        email: parsed.email,
        organization: parsed.organization ?? null,
        pathway: parsed.pathway,
        domain: parsed.domain ?? null,
        message: parsed.message ?? null,
        source: parsed.source,
        status: 'new',
      };

      const { data, error } = await client
        .from('access_requests')
        .insert(row)
        .select('id')
        .single();
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          const { data: replay } = await client
            .from('access_requests')
            .select('id')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();
          if (replay && (replay as { id?: string }).id) {
            return reflectedJsonResponse(rawOrigin, {
              ok: true,
              id: (replay as { id: string }).id,
            });
          }
        }
        return reflectedErrorResponse(rawOrigin, 'Internal server error', 500);
      }

      return reflectedJsonResponse(rawOrigin, { ok: true, id: data?.id });
    } catch (err) {
      if (err instanceof AccessRequestValidationError) {
        return reflectedErrorResponse(rawOrigin, err.message, err.status);
      }
      if (err instanceof SyntaxError) {
        return reflectedErrorResponse(rawOrigin, 'Invalid JSON body', 400);
      }
      return reflectedErrorResponse(rawOrigin, 'Internal server error', 500);
    }
  }),
);
