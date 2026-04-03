import { corsHeaders } from './cors.ts';

/**
 * Auth-guard helper for Supabase edge functions.
 *
 * Returns a discriminated-union result so callers can early-return the
 * built-in 401 response without additional boilerplate.
 */

export type AuthGuardResult =
  | { ok: true; token: string }
  | { ok: false; response: Response };

/**
 * Extracts the bearer token from an `Authorization: Bearer <token>` header.
 * Returns `null` when the header is absent or does not match the Bearer scheme.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match ? match[1] ?? null : null;
}

/**
 * Guards an edge-function handler by requiring a valid Bearer token.
 *
 * On failure the `response` field is a ready-to-return 401 JSON response so
 * callers can do:
 *
 * ```ts
 * const auth = guardAuth(req);
 * if (!auth.ok) return auth.response;
 * ```
 */
export function guardAuth(req: Request): AuthGuardResult {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      ),
    };
  }
  return { ok: true, token };
}
