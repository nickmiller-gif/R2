export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id, x-idempotency-key',
};

export function corsResponse() {
  return new Response('ok', { headers: corsHeaders });
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Reflected CORS helpers for widget endpoints.
//
// The wildcard `Access-Control-Allow-Origin: *` in `corsHeaders` is safe for
// endpoints that carry no ambient credentials (no cookies, no Authorization
// header), which is the status quo for all Supabase Functions here — auth
// travels in request bodies (widget_token) or explicit Authorization headers
// and origins are independently validated server-side.
//
// For the widget endpoints (`eigen-widget-session`, `eigen-widget-chat`)
// the audit called for defense-in-depth: reflect the validated Origin back
// instead of `*`, and always set `Vary: Origin` so caches do not conflate
// responses across origins. These helpers do NOT replace the server-side
// allowlist check — they only take effect once `eigen-widget-session` has
// confirmed the Origin is in the site registry or `eigen-widget-chat` has
// verified the HMAC-signed widget token whose claims include the origin.
// ---------------------------------------------------------------------------

const ACA_HEADERS_VALUE =
  'authorization, x-client-info, apikey, content-type, x-correlation-id, x-idempotency-key';

export function reflectedCorsHeaders(origin: string | null | undefined): Record<string, string> {
  const trimmed = typeof origin === 'string' ? origin.trim() : '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ACA_HEADERS_VALUE,
    Vary: 'Origin',
  };
  if (trimmed.length > 0) {
    headers['Access-Control-Allow-Origin'] = trimmed;
  } else {
    // Fall back to wildcard when no Origin was sent (server-to-server,
    // curl without `-H Origin`). Reflective allowlisting only matters
    // when a browser is present, and browsers always send Origin on
    // cross-origin fetch. Vary: Origin is still emitted so any shared
    // cache keys the reply correctly.
    headers['Access-Control-Allow-Origin'] = '*';
  }
  return headers;
}

export function reflectedCorsResponse(origin: string | null | undefined): Response {
  return new Response('ok', { headers: reflectedCorsHeaders(origin) });
}

export function reflectedJsonResponse(
  origin: string | null | undefined,
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...reflectedCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

export function reflectedErrorResponse(
  origin: string | null | undefined,
  message: string,
  status = 400,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...reflectedCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}
