import {
  reflectedCorsHeaders,
  reflectedCorsResponse,
  reflectedErrorResponse,
  reflectedJsonResponse,
} from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
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

interface AccessRequestBody {
  name: string;
  email: string;
  organization?: string;
  pathway: string;
  domain?: string;
  message?: string;
  source?: string;
}

function parseBody(value: unknown): AccessRequestBody {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  const body = value as Record<string, unknown>;
  if (typeof body.name !== 'string' || body.name.trim().length < 1)
    throw new Error('name is required');
  if (typeof body.email !== 'string' || body.email.trim().length < 3)
    throw new Error('email is required');
  if (typeof body.pathway !== 'string' || body.pathway.trim().length < 1) {
    throw new Error('pathway is required');
  }
  const email = body.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('email format is invalid');

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

Deno.serve(
  withRequestMeta(async (req) => {
    const rawOrigin = req.headers.get('origin');
    if (req.method === 'OPTIONS') return reflectedCorsResponse(rawOrigin);
    if (req.method !== 'POST') return reflectedErrorResponse(rawOrigin, 'Method not allowed', 405);

    const allowed = loadAllowedOrigins();
    if (!rawOrigin || !isAllowedOrigin(rawOrigin, allowed)) {
      return reflectedErrorResponse(rawOrigin, 'Origin not allowed', 403);
    }

    try {
      const parsed = parseBody(await req.json());
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

      const row = {
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
      if (error) throw new Error(error.message);

      return reflectedJsonResponse(rawOrigin, { ok: true, id: data?.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const status = message.includes('required') || message.includes('invalid') ? 400 : 500;
      return reflectedErrorResponse(rawOrigin, message, status);
    }
  }),
);
