import * as jose from 'jsr:@panva/jose@6';
import { corsHeaders } from './cors.ts';

/**
 * Edge-function auth guard — jose + JWKS (ADR-002).
 *
 * Verifies Supabase-issued JWTs offline using the project's public JWKS.
 * After initial fetch the key set is cached; subsequent verifications are
 * pure in-memory cryptographic operations with zero network overhead.
 *
 * Works identically for every Lovable frontend because they all authenticate
 * against the same Supabase project and produce JWTs signed by the same keys.
 */

// ---------------------------------------------------------------------------
// JWKS setup (cached at module level — shared across invocations)
// ---------------------------------------------------------------------------

const _rawSupabaseUrl = Deno.env.get('SUPABASE_URL');
if (!_rawSupabaseUrl) {
  throw new Error(
    'SUPABASE_URL environment variable is not set. ' +
      'Edge functions cannot verify JWTs without a valid SUPABASE_URL.',
  );
}
const SUPABASE_URL = _rawSupabaseUrl.replace(/\/+$/, '');

const SUPABASE_JWT_ISSUER =
  Deno.env.get('SB_JWT_ISSUER') ?? `${SUPABASE_URL}/auth/v1`;

const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Claims extracted from a verified Supabase JWT. */
export interface VerifiedClaims {
  /** Supabase user ID (the `sub` claim). */
  userId: string;
  /** User email from the token, if present. */
  email?: string;
  /** Supabase role claim (e.g. "authenticated"). */
  role?: string;
  /** Full decoded JWT payload for advanced use. */
  payload: jose.JWTPayload;
}

export type AuthGuardResult =
  | { ok: true; claims: VerifiedClaims }
  | { ok: false; response: Response };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function authError(message: string, status = 401): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// ---------------------------------------------------------------------------
// Main guard
// ---------------------------------------------------------------------------

/**
 * Verifies the request's Bearer token against Supabase JWKS.
 *
 * On success returns the verified claims (userId, email, role, full payload).
 * On failure returns a ready-to-return 401 JSON response:
 *
 * ```ts
 * const auth = await guardAuth(req);
 * if (!auth.ok) return auth.response;
 * const { userId } = auth.claims;
 * ```
 *
 * NOTE: This is now **async** because JWT verification is an async operation.
 */
export async function guardAuth(req: Request): Promise<AuthGuardResult> {
  const token = extractBearerToken(req);
  if (!token) {
    return { ok: false, response: authError('Missing or invalid Authorization header') };
  }

  try {
    const { payload } = await jose.jwtVerify(token, SUPABASE_JWT_KEYS, {
      issuer: SUPABASE_JWT_ISSUER,
    });

    const userId = payload.sub;
    if (!userId) {
      return { ok: false, response: authError('JWT missing sub claim') };
    }

    return {
      ok: true,
      claims: {
        userId,
        email: payload.email as string | undefined,
        role: payload.role as string | undefined,
        payload,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[auth] jwt verification failed', { error: errorMessage });
    return { ok: false, response: authError('Invalid or expired token') };
  }
}
