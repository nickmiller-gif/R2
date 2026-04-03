/**
 * Tests for the shared edge-function utilities (foundation-03).
 *
 * Covers: auth guard, correlation/idempotency extraction, and
 * CORS-aware response builders.
 */
import { describe, it, expect } from 'vitest';
import { extractBearerToken, guardAuth } from '../../src/lib/edge/auth.js';
import {
  extractRequestMeta,
  metaResponseHeaders,
  CORRELATION_ID_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from '../../src/lib/edge/correlation.js';
import {
  CORS_HEADERS,
  corsPreflightResponse,
  jsonResponse,
  errorResponse,
} from '../../src/lib/edge/response.js';

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('returns the token from a valid Authorization header', () => {
    const headers = new Headers({ authorization: 'Bearer my-token-123' });
    expect(extractBearerToken(headers)).toBe('my-token-123');
  });

  it('is case-insensitive for the "bearer" keyword', () => {
    const headers = new Headers({ authorization: 'BEARER UPPER-TOKEN' });
    expect(extractBearerToken(headers)).toBe('UPPER-TOKEN');
  });

  it('returns null when the Authorization header is absent', () => {
    expect(extractBearerToken(new Headers())).toBeNull();
  });

  it('returns null when the header does not use the Bearer scheme', () => {
    const headers = new Headers({ authorization: 'Basic dXNlcjpwYXNz' });
    expect(extractBearerToken(headers)).toBeNull();
  });
});

describe('guardAuth', () => {
  it('returns ok:true with the token when Authorization is valid', () => {
    const headers = new Headers({ authorization: 'Bearer valid-token' });
    const result = guardAuth(headers);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token).toBe('valid-token');
  });

  it('returns ok:false with an error message when Authorization is absent', () => {
    const result = guardAuth(new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/authorization/i);
  });

  it('returns ok:false when the Authorization header is not Bearer format', () => {
    const headers = new Headers({ authorization: 'Basic dXNlcjpwYXNz' });
    const result = guardAuth(headers);
    expect(result.ok).toBe(false);
  });
});

// ─── Correlation / idempotency ────────────────────────────────────────────────

describe('extractRequestMeta', () => {
  it('passes through an existing correlation id', () => {
    const headers = new Headers({ [CORRELATION_ID_HEADER]: 'trace-abc' });
    const meta = extractRequestMeta(headers);
    expect(meta.correlationId).toBe('trace-abc');
  });

  it('generates a UUID correlation id when the header is absent', () => {
    const meta = extractRequestMeta(new Headers());
    expect(meta.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates distinct ids on successive calls without the header', () => {
    const a = extractRequestMeta(new Headers()).correlationId;
    const b = extractRequestMeta(new Headers()).correlationId;
    expect(a).not.toBe(b);
  });

  it('extracts the idempotency key when present', () => {
    const headers = new Headers({ [IDEMPOTENCY_KEY_HEADER]: 'idem-key-1' });
    const meta = extractRequestMeta(headers);
    expect(meta.idempotencyKey).toBe('idem-key-1');
  });

  it('sets idempotencyKey to null when the header is absent', () => {
    const meta = extractRequestMeta(new Headers());
    expect(meta.idempotencyKey).toBeNull();
  });
});

describe('metaResponseHeaders', () => {
  it('returns an object containing the correlation id header', () => {
    const result = metaResponseHeaders('my-correlation-id');
    expect(result[CORRELATION_ID_HEADER]).toBe('my-correlation-id');
  });
});

// ─── Response builders ────────────────────────────────────────────────────────

describe('CORS_HEADERS', () => {
  it('allows any origin', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
  });

  it('includes x-correlation-id in allowed headers', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('x-correlation-id');
  });

  it('includes x-idempotency-key in allowed headers', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('x-idempotency-key');
  });
});

describe('corsPreflightResponse', () => {
  it('returns HTTP 200 with CORS origin header set', () => {
    const res = corsPreflightResponse();
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('jsonResponse', () => {
  it('returns 200 with a JSON body by default', async () => {
    const res = jsonResponse({ id: '1', name: 'test' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ id: '1', name: 'test' });
  });

  it('accepts a custom status code', () => {
    expect(jsonResponse({ id: '1' }, 201).status).toBe(201);
  });

  it('merges extra headers into the response', () => {
    const res = jsonResponse({}, 200, { [CORRELATION_ID_HEADER]: 'c-123' });
    expect(res.headers.get(CORRELATION_ID_HEADER)).toBe('c-123');
  });

  it('carries CORS origin header', () => {
    const res = jsonResponse({});
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('errorResponse', () => {
  it('returns 400 with an error body by default', async () => {
    const res = errorResponse('something went wrong');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'something went wrong' });
  });

  it('accepts a custom status code', () => {
    expect(errorResponse('not found', 404).status).toBe(404);
  });

  it('merges extra headers into the response', () => {
    const res = errorResponse('oops', 500, { [CORRELATION_ID_HEADER]: 'e-456' });
    expect(res.headers.get(CORRELATION_ID_HEADER)).toBe('e-456');
  });

  it('carries CORS origin header', () => {
    const res = errorResponse('bad request');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
