import { describe, expect, it } from 'vitest';
import {
  buildSourceSignalKey,
  normalizeSignalSignature,
  signHmacSha256,
  timingSafeEqual,
  verifySignalHmac,
} from '../../supabase/functions/_shared/signal-utils.ts';

describe('signal ingest utils', () => {
  it('builds deterministic idempotent source keys', () => {
    expect(buildSourceSignalKey('centralr2', 'abc-123')).toBe('centralr2:abc-123');
  });

  it('normalizes sha256 signatures', () => {
    expect(normalizeSignalSignature('sha256=ABC123')).toBe('abc123');
    expect(normalizeSignalSignature('ABC123')).toBe('abc123');
    expect(normalizeSignalSignature(null)).toBe('');
  });

  it('compares signatures in a timing-safe style', () => {
    expect(timingSafeEqual('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqual('abcd', 'abce')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('validates hmac signatures', async () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ hello: 'world' });
    const validSignature = await signHmacSha256(secret, body);
    const validHeader = `sha256=${validSignature}`;
    const ok = await verifySignalHmac(secret, body, validHeader);
    const bad = await verifySignalHmac(secret, body, 'sha256=deadbeef');

    expect(ok).toBe(true);
    expect(bad).toBe(false);
  });
});
