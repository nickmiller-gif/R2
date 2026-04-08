/**
 * JWT verification with jose v6 — ES256/RS256 asymmetric key support.
 *
 * Supabase moved to asymmetric signing keys (ES256) for new projects.
 * This module uses the JWKS endpoint for verification, with caching
 * handled by jose's createRemoteJWKSet (CDN-cached for ~10min).
 *
 * Initialize JWKS at module level so the cache persists across requests
 * in the same Edge Function isolate.
 */
import * as jose from 'jsr:@panva/jose@6';

// Lazily initialized at first use so module import doesn't crash when
// SUPABASE_URL is absent (e.g., during unit test imports or cold-start probes).
let _jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!_jwks) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    _jwks = jose.createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }
  return _jwks;
}

export interface JwtPayload {
  /** User ID (subject claim). */
  sub: string;
  /** Role: 'authenticated', 'anon', 'service_role'. */
  role: string;
  /** Email if present. */
  email?: string;
  /** Authenticator Assurance Level. */
  aal?: string;
  /** Session ID. */
  session_id?: string;
  /** Issued at (unix seconds). */
  iat?: number;
  /** Expiration (unix seconds). */
  exp?: number;
}

/**
 * Verify a Supabase JWT and return the decoded payload.
 *
 * @throws {Error} If the token is missing, expired, or has an invalid signature.
 */
export async function verifyJwt(token: string): Promise<JwtPayload> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  const { payload } = await jose.jwtVerify(token, getJwks(), {
    issuer: `${supabaseUrl}/auth/v1`,
    clockTolerance: '15s', // Handle clock skew between servers
  });

  return payload as unknown as JwtPayload;
}

/**
 * Extract and verify JWT from a request's Authorization header.
 * Returns a discriminated union for easy early-return pattern.
 */
export type JwtGuardResult =
  | { ok: true; payload: JwtPayload; token: string }
  | { ok: false; error: string };

export async function guardJwt(req: Request): Promise<JwtGuardResult> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { ok: false, error: 'Missing Authorization header' };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match || !match[1]) {
    return { ok: false, error: 'Invalid Authorization header format' };
  }

  const token = match[1];

  try {
    const payload = await verifyJwt(token);
    return { ok: true, payload, token };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JWT verification failed';
    return { ok: false, error: message };
  }
}
