/**
 * Auth-guard helpers for edge functions — NODE/TEST ENVIRONMENT ONLY.
 *
 * These are pure header-extraction utilities that operate on the standard
 * `Headers` object so they are testable in Node.js without a Deno runtime.
 *
 * ⚠️  SECURITY BOUNDARY: These helpers only check that a Bearer token is
 * present in the Authorization header. They do NOT verify the JWT signature,
 * expiry, issuer, or any other cryptographic claim.
 *
 * The real auth guard (supabase/functions/_shared/auth.ts) performs full
 * offline JWKS verification via `jose`. Edge functions MUST import from
 * `../_shared/auth.ts`, never from this file.
 *
 * This file exists solely to allow unit testing of header-parsing logic
 * in the Node.js test environment where Deno globals are unavailable.
 */

/** Discriminated-union result returned by {@link guardAuth}. */
export type AuthGuardResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Extracts the bearer token from an `Authorization: Bearer <token>` header.
 * Returns `null` when the header is absent or does not match the Bearer scheme.
 */
export function extractBearerToken(headers: Headers): string | null {
  const authHeader = headers.get('authorization');
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match ? (match[1] ?? null) : null;
}

/**
 * Validates that the request carries a Bearer token.
 *
 * Returns `{ ok: true, token }` on success or `{ ok: false, error }` when the
 * Authorization header is absent or malformed.
 */
export function guardAuth(headers: Headers): AuthGuardResult {
  const token = extractBearerToken(headers);
  if (!token) {
    return { ok: false, error: 'Missing or invalid Authorization header' };
  }
  return { ok: true, token };
}
