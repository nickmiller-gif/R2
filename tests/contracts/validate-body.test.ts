import { describe, expect, it } from 'vitest';

import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  isUuidString,
  requireIdempotencyKey,
  validateBody,
} from '../../supabase/functions/_shared/validate.ts';

/**
 * Guards the edge-function `validateBody` helper against a typeof-based
 * blind spot: `typeof [] === 'object'`, so a caller declaring a field as
 * `type: 'object'` previously silently accepted arrays, corrupting
 * downstream assumptions (key spreading, property access).
 */

function jsonRequest(body: unknown): Request {
  return new Request('https://example.invalid/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('validateBody', () => {
  it('accepts a well-formed object field', async () => {
    const req = jsonRequest({ metadata: { foo: 'bar' } });
    const result = await validateBody<{ metadata: Record<string, unknown> }>(req, [
      { name: 'metadata', type: 'object' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.metadata).toEqual({ foo: 'bar' });
    }
  });

  it('rejects arrays declared as object fields', async () => {
    const req = jsonRequest({ metadata: [1, 2, 3] });
    const result = await validateBody(req, [{ name: 'metadata', type: 'object' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = (await result.response.json()) as { error: string };
      expect(body.error).toMatch(/must be a JSON object, not an array/);
    }
  });

  it('reports typeof mismatch before the array check', async () => {
    const req = jsonRequest({ metadata: 'not-an-object' });
    const result = await validateBody(req, [{ name: 'metadata', type: 'object' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as { error: string };
      expect(body.error).toMatch(/must be of type object/);
      expect(body.error).not.toMatch(/not an array/);
    }
  });

  it('rejects a top-level array body', async () => {
    const req = jsonRequest([{ foo: 'bar' }]);
    const result = await validateBody(req, [{ name: 'foo', type: 'string' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as { error: string };
      expect(body.error).toMatch(/must be a JSON object/);
    }
  });

  it('allows missing optional object fields to pass', async () => {
    const req = jsonRequest({});
    const result = await validateBody<{ metadata?: Record<string, unknown> }>(req, [
      { name: 'metadata', type: 'object', required: false },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('isUuidString', () => {
  it('accepts canonical UUIDs', () => {
    expect(isUuidString('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuidString(' 6ba7b810-9dad-11d1-80b4-00c04fd430c8 ')).toBe(true);
  });
  it('rejects non-UUIDs', () => {
    expect(isUuidString('')).toBe(false);
    expect(isUuidString('not-a-uuid')).toBe(false);
    expect(isUuidString('00000000-0000-0000-0000-000000000000,inject')).toBe(false);
  });
});

describe('requireIdempotencyKey', () => {
  function reqWithKey(value: string | undefined): Request {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (value !== undefined) headers['x-idempotency-key'] = value;
    return new Request('https://example.invalid/', { method: 'POST', headers });
  }

  it('returns null for a normal idempotency key', () => {
    expect(requireIdempotencyKey(reqWithKey('abc-123'))).toBeNull();
  });

  it('rejects a missing idempotency key', () => {
    const result = requireIdempotencyKey(reqWithKey(undefined));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
  });

  it('rejects an idempotency key above the length cap', async () => {
    const oversized = 'a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1);
    const result = requireIdempotencyKey(reqWithKey(oversized));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
    if (result) {
      const body = (await result.json()) as { error: string };
      expect(body.error).toMatch(/<= 256 characters/);
    }
  });

  it('accepts an idempotency key exactly at the length cap', () => {
    const atCap = 'a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH);
    expect(requireIdempotencyKey(reqWithKey(atCap))).toBeNull();
  });
});
