export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id, x-idempotency-key',
};

export function corsResponse() {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Returns a JSON success response with standard CORS headers.
 *
 * @param data  - Any JSON-serialisable value.
 * @param status - HTTP status code (default 200).
 * @param extra  - Additional headers to merge, e.g. `metaResponseHeaders(correlationId)`.
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

/**
 * Returns a JSON error response `{ error: message }` with standard CORS headers.
 *
 * @param message - Human-readable error description.
 * @param status  - HTTP status code (default 400).
 * @param extra   - Additional headers to merge, e.g. `metaResponseHeaders(correlationId)`.
 */
export function errorResponse(
  message: string,
  status = 400,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}
