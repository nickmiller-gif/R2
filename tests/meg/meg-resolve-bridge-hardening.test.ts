import { describe, expect, it } from 'vitest';
import {
  MIN_BRIDGE_TOKEN_LEN,
  getRequesterFingerprint,
  isAcceptableContentType,
  isCanonicalOverrideAllowed,
  isSourcePlatformAllowed,
  parseAllowedSources,
  validateBridgeToken,
} from '../../supabase/functions/_shared/meg-bridge-policy.ts';

// Unit-level proofs for the meg-resolve-bridge hardening helpers
// (`MEG_RESOLVE_BRIDGE_*` policies). The bridge runs with gateway
// `verify_jwt = false`, so every defense is in code (per ADR-0003 framing).
// Edge-function lifecycle is covered separately by integration smoke tests.

describe('validateBridgeToken', () => {
  it('flags missing / empty values', () => {
    expect(validateBridgeToken(undefined)).toBe('missing');
    expect(validateBridgeToken(null)).toBe('missing');
    expect(validateBridgeToken('')).toBe('missing');
    expect(validateBridgeToken('   ')).toBe('missing');
  });

  it('flags weak tokens shorter than the safety floor', () => {
    expect(validateBridgeToken('shortie')).toBe('weak');
    // exactly one byte below the floor → weak
    expect(validateBridgeToken('a'.repeat(MIN_BRIDGE_TOKEN_LEN - 1))).toBe('weak');
  });

  it('accepts tokens at or above the safety floor', () => {
    expect(validateBridgeToken('a'.repeat(MIN_BRIDGE_TOKEN_LEN))).toBe('ok');
    // 64 hex chars (`openssl rand -hex 32`) — the runbook default
    expect(validateBridgeToken('a'.repeat(64))).toBe('ok');
  });

  it('ignores surrounding whitespace when measuring length', () => {
    const padded = `  ${'a'.repeat(MIN_BRIDGE_TOKEN_LEN)}  `;
    expect(validateBridgeToken(padded)).toBe('ok');
  });
});

describe('parseAllowedSources', () => {
  it('returns null (allow-all) for unset / empty input', () => {
    expect(parseAllowedSources(undefined)).toBeNull();
    expect(parseAllowedSources(null)).toBeNull();
    expect(parseAllowedSources('')).toBeNull();
    expect(parseAllowedSources('   ')).toBeNull();
    // a list of only commas / whitespace is effectively empty
    expect(parseAllowedSources(', ,  ,')).toBeNull();
  });

  it('trims, lowercases, and dedupes entries', () => {
    expect(parseAllowedSources('Ip_Pulse_Point, centralr2 , IP_PULSE_POINT')).toEqual([
      'ip_pulse_point',
      'centralr2',
    ]);
  });
});

describe('isSourcePlatformAllowed', () => {
  it('allows any platform when allowlist is null (back-compat)', () => {
    expect(isSourcePlatformAllowed('anything', null)).toBe(true);
    expect(isSourcePlatformAllowed('', null)).toBe(true);
  });

  it('matches case-insensitively against the allowlist', () => {
    const allowed = parseAllowedSources('ip_pulse_point,centralr2')!;
    expect(isSourcePlatformAllowed('IP_PULSE_POINT', allowed)).toBe(true);
    expect(isSourcePlatformAllowed('centralr2', allowed)).toBe(true);
    expect(isSourcePlatformAllowed('attacker_platform', allowed)).toBe(false);
  });
});

describe('isCanonicalOverrideAllowed', () => {
  it('defaults to true when unset (preserves published contract)', () => {
    expect(isCanonicalOverrideAllowed(undefined)).toBe(true);
    expect(isCanonicalOverrideAllowed(null)).toBe(true);
    expect(isCanonicalOverrideAllowed('')).toBe(true);
    expect(isCanonicalOverrideAllowed('   ')).toBe(true);
  });

  it('treats falsy literals as disable (case/whitespace-insensitive)', () => {
    expect(isCanonicalOverrideAllowed('false')).toBe(false);
    expect(isCanonicalOverrideAllowed('FALSE')).toBe(false);
    expect(isCanonicalOverrideAllowed(' 0 ')).toBe(false);
    expect(isCanonicalOverrideAllowed('no')).toBe(false);
    expect(isCanonicalOverrideAllowed('off')).toBe(false);
  });

  it('treats anything else as enabled', () => {
    expect(isCanonicalOverrideAllowed('true')).toBe(true);
    expect(isCanonicalOverrideAllowed('1')).toBe(true);
    expect(isCanonicalOverrideAllowed('yes')).toBe(true);
    expect(isCanonicalOverrideAllowed('on')).toBe(true);
  });
});

describe('isAcceptableContentType', () => {
  it('accepts absent / empty Content-Type (server-to-server fetch back-compat)', () => {
    expect(isAcceptableContentType(null)).toBe(true);
    expect(isAcceptableContentType(undefined)).toBe(true);
    expect(isAcceptableContentType('')).toBe(true);
    expect(isAcceptableContentType('   ')).toBe(true);
  });

  it('accepts application/json with and without charset', () => {
    expect(isAcceptableContentType('application/json')).toBe(true);
    expect(isAcceptableContentType('Application/JSON; charset=utf-8')).toBe(true);
    expect(isAcceptableContentType('  application/json ; charset=UTF-8  ')).toBe(true);
  });

  it('rejects other media types', () => {
    expect(isAcceptableContentType('text/plain')).toBe(false);
    expect(isAcceptableContentType('application/x-www-form-urlencoded')).toBe(false);
    expect(isAcceptableContentType('multipart/form-data; boundary=---')).toBe(false);
  });
});

describe('getRequesterFingerprint', () => {
  function mkReq(headers: Record<string, string>): Request {
    return new Request('https://example.test/meg-resolve-bridge', {
      method: 'POST',
      headers,
    });
  }

  it('prefers cf-connecting-ip over x-real-ip over x-forwarded-for', () => {
    expect(
      getRequesterFingerprint(
        mkReq({
          'cf-connecting-ip': '203.0.113.10',
          'x-real-ip': '198.51.100.20',
          'x-forwarded-for': '198.51.100.30, 10.0.0.1',
        }),
      ).ip,
    ).toBe('203.0.113.10');

    expect(
      getRequesterFingerprint(
        mkReq({
          'x-real-ip': '198.51.100.20',
          'x-forwarded-for': '198.51.100.30, 10.0.0.1',
        }),
      ).ip,
    ).toBe('198.51.100.20');

    expect(
      getRequesterFingerprint(mkReq({ 'x-forwarded-for': '198.51.100.30, 10.0.0.1' })).ip,
    ).toBe('198.51.100.30');
  });

  it('falls back to unknown-ip / unknown-ua when headers absent', () => {
    const fp = getRequesterFingerprint(mkReq({}));
    expect(fp.ip).toBe('unknown-ip');
    expect(fp.userAgent).toBe('unknown-ua');
  });

  it('caps user-agent at 256 chars to bound log payload size', () => {
    const long = 'A'.repeat(1024);
    const fp = getRequesterFingerprint(mkReq({ 'user-agent': long }));
    expect(fp.userAgent.length).toBe(256);
  });
});
