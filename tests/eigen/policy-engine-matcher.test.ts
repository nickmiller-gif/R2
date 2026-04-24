import { describe, expect, it } from 'vitest';

import { matchWildcard } from '../../src/lib/eigen/eigen-policy-eval.ts';

/**
 * Guards the linear two-pointer glob matcher against regressions — both
 * correctness regressions (new contributor swaps the implementation out for
 * a regex for "speed") and ReDoS regressions (a regex form with catastrophic
 * backtracking would take seconds on the adversarial case below). The
 * matcher runs on every Eigen request's hot path, so a slow path here
 * degrades the entire Eigen surface.
 */
describe('matchWildcard (linear glob matcher)', () => {
  it('exact match when no wildcard', () => {
    expect(matchWildcard('write:index', 'write:index')).toBe(true);
    expect(matchWildcard('write:index', 'write:query')).toBe(false);
  });

  it('lone * matches anything including empty', () => {
    expect(matchWildcard('*', '')).toBe(true);
    expect(matchWildcard('*', 'anything')).toBe(true);
  });

  it('prefix pattern', () => {
    expect(matchWildcard('write:*', 'write:index')).toBe(true);
    expect(matchWildcard('write:*', 'write:')).toBe(true);
    expect(matchWildcard('write:*', 'read:index')).toBe(false);
  });

  it('suffix pattern', () => {
    expect(matchWildcard('*:index', 'write:index')).toBe(true);
    expect(matchWildcard('*:index', ':index')).toBe(true);
    expect(matchWildcard('*:index', 'write:query')).toBe(false);
  });

  it('middle pattern', () => {
    expect(matchWildcard('ai:*:synth', 'ai:oracle:synth')).toBe(true);
    expect(matchWildcard('ai:*:synth', 'ai::synth')).toBe(true);
    expect(matchWildcard('ai:*:synth', 'ai:oracle:query')).toBe(false);
  });

  it('multiple stars', () => {
    expect(matchWildcard('a*b*c', 'abc')).toBe(true);
    expect(matchWildcard('a*b*c', 'axbyc')).toBe(true);
    expect(matchWildcard('a*b*c', 'xbyc')).toBe(false);
  });

  it('policy_tag wildcard scopes (seed shape)', () => {
    expect(matchWildcard('eigenx:*', 'eigenx:user:1234')).toBe(true);
    expect(matchWildcard('eigenx:*', 'eigenx')).toBe(false);
    expect(matchWildcard('eigenx', 'eigenx')).toBe(true);
  });

  it('is linear-time on adversarial ReDoS-style patterns', () => {
    // This pattern causes catastrophic backtracking with a regex built via
    // `*` -> `.*` substitution. Against the old regex-based matcher this
    // test would burn tens of seconds on V8 before returning; the linear
    // two-pointer form completes in well under 50ms even on a long
    // non-matching input. 50ms has ~300x headroom over the expected ~0.1ms
    // runtime so it is not flaky in CI.
    const pattern = 'a*a*a*a*a*a*a*a*a*a*a*!';
    const value = 'a'.repeat(200);
    const start = performance.now();
    const result = matchWildcard(pattern, value);
    const elapsedMs = performance.now() - start;
    expect(result).toBe(false);
    expect(elapsedMs).toBeLessThan(50);
  });

  it('regex metacharacters in the pattern are treated literally', () => {
    // The old regex matcher escaped these, so this also asserts that the
    // switchover preserves that semantics — a contributor who tried to
    // reintroduce `*` -> `.*` without the escape would break this test.
    expect(matchWildcard('a.b', 'a.b')).toBe(true);
    expect(matchWildcard('a.b', 'axb')).toBe(false);
    expect(matchWildcard('(x)', '(x)')).toBe(true);
    expect(matchWildcard('(x)', 'x')).toBe(false);
  });
});
