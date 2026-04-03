/**
 * Correlation-ID and idempotency-key helpers for edge functions.
 *
 * Extracts or generates a `x-correlation-id` for request tracing, and
 * surfaces the optional `x-idempotency-key` used by callers to prevent
 * duplicate mutations.
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
 * Reads `x-correlation-id` and `x-idempotency-key` from the supplied headers.
 *
 * When `x-correlation-id` is absent a new UUID v4 is generated so every
 * request carries a traceable ID regardless of whether the caller provided one.
 */
export function extractRequestMeta(headers: Headers): RequestMeta {
  const correlationId = headers.get(CORRELATION_ID_HEADER) ?? crypto.randomUUID();
  const idempotencyKey = headers.get(IDEMPOTENCY_KEY_HEADER);
  return { correlationId, idempotencyKey };
}

/**
 * Produces a headers object that echoes the correlation ID back to the caller.
 * Merge this into the response headers so clients can correlate responses to
 * their originating requests.
 */
export function metaResponseHeaders(correlationId: string): Record<string, string> {
  return { [CORRELATION_ID_HEADER]: correlationId };
}
