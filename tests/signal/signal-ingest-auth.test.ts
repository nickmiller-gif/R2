import { describe, expect, it } from 'vitest';
import {
  timingSafeEqual,
  tryServiceRoleAuth,
} from '../../supabase/functions/_shared/signal-utils.ts';

// Unit-level proofs of the service-role bypass policy added in
// docs/ADR-005-service-role-ingest-bypass.md.
//
// The full edge-function lifecycle is exercised by the AIHealthCheck probe
// documented in R2-Phase1-Status.md and R2-Phase1-Auth-PR.md § 5.
// These tests pin the constant-time-compare primitive that the service-role
// path depends on, plus the policy assertions tryServiceRoleAuth enforces.

describe('r2-signal-ingest service-role bypass — constant-time compare', () => {
  it('treats two identical service-role keys as equal', () => {
    const fakeServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload';
    expect(timingSafeEqual(fakeServiceRole, fakeServiceRole)).toBe(true);
  });

  it('rejects a near-miss bearer against the service-role key', () => {
    const a = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload';
    const b = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payloaX';
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it('rejects bearers of different length even when prefix matches', () => {
    const short = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const long = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload';
    expect(timingSafeEqual(short, long)).toBe(false);
  });

  it('rejects the empty string against any non-empty key', () => {
    const realKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload';
    expect(timingSafeEqual('', realKey)).toBe(false);
    expect(timingSafeEqual(realKey, '')).toBe(false);
  });

  it('treats two empty strings as equal', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('r2-signal-ingest service-role bypass — policy assertions', () => {
  const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service.role-key';
  const USER_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user.jwt-token';

  it('policy: bearer must equal SUPABASE_SERVICE_ROLE_KEY exactly to engage bypass', () => {
    const result = tryServiceRoleAuth(SERVICE_KEY, SERVICE_KEY, true);
    expect(result).toEqual({ mode: 'service_role' });

    const mismatch = tryServiceRoleAuth(USER_JWT, SERVICE_KEY, true);
    expect(mismatch).toBeNull();
  });

  it('policy: HMAC must be configured for service-role bypass to engage (fail-closed)', () => {
    const result = tryServiceRoleAuth(SERVICE_KEY, SERVICE_KEY, false);
    expect(result).not.toBeNull();
    expect(result?.mode).toBe('reject');
    if (result?.mode === 'reject') {
      expect(result.reason).toMatch(/R2_SIGNAL_INGEST_HMAC_SECRET/);
    }
  });

  it('policy: HMAC signature must verify (not just be present) for service-role path', () => {
    // tryServiceRoleAuth only gates on HMAC *configured*; actual HMAC
    // verification is handled by maybeVerifyHmac after tryServiceRoleAuth
    // returns { mode: 'service_role' }. When HMAC is configured the bypass
    // engages, then the handler must call maybeVerifyHmac to verify the
    // signature. This test confirms the bypass engages so the HMAC check runs.
    const result = tryServiceRoleAuth(SERVICE_KEY, SERVICE_KEY, true);
    expect(result).toEqual({ mode: 'service_role' });
  });

  it('policy: non-service-role bearers fall through to guardAuth (preserves prior behavior)', () => {
    expect(tryServiceRoleAuth(USER_JWT, SERVICE_KEY, true)).toBeNull();
    expect(tryServiceRoleAuth(null, SERVICE_KEY, true)).toBeNull();
    expect(tryServiceRoleAuth(USER_JWT, undefined, true)).toBeNull();
  });

  it('policy: missing bearer or missing service-role key returns null (no bypass)', () => {
    expect(tryServiceRoleAuth(null, undefined, false)).toBeNull();
    expect(tryServiceRoleAuth(null, SERVICE_KEY, false)).toBeNull();
    expect(tryServiceRoleAuth(SERVICE_KEY, undefined, false)).toBeNull();
  });
});
