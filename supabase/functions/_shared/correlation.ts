/**
 * Correlation-ID and idempotency-key helpers for Supabase edge functions.
 */

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';

/** Tracing metadata extracted (or generated) from inbound request headers. */
export interface RequestMeta {
  /** Caller-supplied or freshly-generated UUID for this request trace. */
  correlationId: string;
  /** Caller-supplied idempotency key, or `null` when not provided. */
  idempotencyKey: string | null;
}

/**
 * Reads `x-correlation-id` and `x-idempotency-key` from the request.
 * Generates a fresh UUID when `x-correlation-id` is absent.
 */
export function extractRequestMeta(req: Request): RequestMeta {
  const correlationId = req.headers.get(CORRELATION_ID_HEADER) ?? crypto.randomUUID();
  const idempotencyKey = req.headers.get(IDEMPOTENCY_KEY_HEADER);
  return { correlationId, idempotencyKey };
}

/**
 * Returns a headers object that echoes the correlation ID back to the caller.
 * Merge into the response headers so clients can correlate responses to their
 * originating requests.
 */
export function metaResponseHeaders(correlationId: string): Record<string, string> {
  return { [CORRELATION_ID_HEADER]: correlationId };
}

type RequestMetaHandler = (req: Request, meta: RequestMeta) => Promise<Response> | Response;

/**
 * Wraps a Deno.serve handler and guarantees `x-correlation-id` is echoed on
 * all successful handler responses.
 */
export function withRequestMeta(handler: RequestMetaHandler) {
  return async (req: Request): Promise<Response> => {
    const meta = extractRequestMeta(req);
    const response = await handler(req, meta);
    const headers = new Headers(response.headers);
    headers.set(CORRELATION_ID_HEADER, meta.correlationId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
