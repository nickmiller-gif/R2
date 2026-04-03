/**
 * CORS-aware response builders for edge functions.
 *
 * Provides a consistent response shape across all edge functions:
 * wildcard CORS origin, JSON content-type, and an optional extra-headers
 * merge point for adding correlation IDs or other per-request metadata.
 */

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id, x-idempotency-key',
};

/** Returns a 200 response for CORS preflight (`OPTIONS`) requests. */
export function corsPreflightResponse(): Response {
  return new Response('ok', { headers: CORS_HEADERS });
}

/**
 * Serialises `data` as JSON with the standard CORS headers.
 *
 * @param data    - Any JSON-serialisable value.
 * @param status  - HTTP status code (default `200`).
 * @param extra   - Additional headers to merge (e.g. `metaResponseHeaders(correlationId)`).
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  });
}

/**
 * Returns a JSON error body `{ error: message }` with the standard CORS headers.
 *
 * @param message - Human-readable error description.
 * @param status  - HTTP status code (default `400`).
 * @param extra   - Additional headers to merge.
 */
export function errorResponse(
  message: string,
  status = 400,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  });
}
