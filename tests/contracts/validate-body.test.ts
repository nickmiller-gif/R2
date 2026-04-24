import { describe, expect, it } from 'vitest';

import { validateBody } from '../../supabase/functions/_shared/validate.ts';

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
