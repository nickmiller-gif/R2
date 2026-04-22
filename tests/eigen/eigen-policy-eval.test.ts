import { describe, expect, it } from 'vitest';
import {
  evaluateEigenPolicyRules,
  evaluateEigenPolicyRulesPerCapability,
} from '../../src/lib/eigen/eigen-policy-eval.js';
import type { EigenPolicyRule } from '../../src/types/eigen/policy-engine.js';

function rule(overrides: Partial<EigenPolicyRule> & Pick<EigenPolicyRule, 'id'>): EigenPolicyRule {
  const now = new Date('2026-04-13T00:00:00.000Z');
  return {
    policyTag: 'eigenx',
    capabilityTagPattern: '*',
    effect: 'allow',
    requiredRole: null,
    rationale: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('evaluateEigenPolicyRulesPerCapability', () => {
  it('matches brute-force per-capability evaluateEigenPolicyRules', () => {
    const rules: EigenPolicyRule[] = [
      rule({ id: 'allow-1', policyTag: 'eigenx', capabilityTagPattern: '*' }),
      rule({
        id: 'deny-1',
        policyTag: 'eigenx',
        capabilityTagPattern: 'write:*',
        effect: 'deny',
        rationale: 'write operations require explicit approval',
      }),
    ];
    const policyTags = ['eigenx'];
    const capabilityTags = ['read:knowledge', 'write:tool-capability', 'search'];
    const callerRoles = ['operator'];

    const batch = evaluateEigenPolicyRulesPerCapability(rules, policyTags, capabilityTags, callerRoles);

    const bruteAllowed: string[] = [];
    const bruteDenied: string[] = [];
    const bruteReasons: Record<string, string[]> = {};
    for (const cap of capabilityTags) {
      const ev = evaluateEigenPolicyRules(rules, {
        policyTags,
        capabilityTags: [cap],
        callerRoles,
      });
      if (ev.allowed) bruteAllowed.push(cap);
      else {
        bruteDenied.push(cap);
        bruteReasons[cap] = ev.denyReasons;
      }
    }

    expect(batch.allowedCapabilityTags).toEqual(bruteAllowed);
    expect(batch.deniedCapabilityTags).toEqual(bruteDenied);
    expect(batch.deniedReasonsByCapability).toEqual(bruteReasons);
  });

  it('deny-over-allow and admin satisfies operator required_role', () => {
    const rules: EigenPolicyRule[] = [
      rule({
        id: 'allow-write-operator',
        policyTag: 'eigenx',
        capabilityTagPattern: 'write:*',
        effect: 'allow',
        requiredRole: 'operator',
      }),
    ];
    const batch = evaluateEigenPolicyRulesPerCapability(
      rules,
      ['eigenx'],
      ['write:tool-capability'],
      ['admin'],
    );
    expect(batch.allowedCapabilityTags).toEqual(['write:tool-capability']);
    expect(batch.deniedCapabilityTags).toEqual([]);
  });

  it('matches wildcard policy tags for user-scoped eigenx policies', () => {
    const rules: EigenPolicyRule[] = [
      rule({
        id: 'allow-user-scope',
        policyTag: 'eigenx:*',
        capabilityTagPattern: 'read:*',
        effect: 'allow',
      }),
    ];
    const batch = evaluateEigenPolicyRulesPerCapability(
      rules,
      ['eigenx:user:1234'],
      ['read:tool-capability'],
      ['member'],
    );
    expect(batch.allowedCapabilityTags).toEqual(['read:tool-capability']);
    expect(batch.deniedCapabilityTags).toEqual([]);
  });

  it('denies capability with no matching allow rule', () => {
    const rules: EigenPolicyRule[] = [
      rule({
        id: 'allow-read',
        policyTag: 'eigenx',
        capabilityTagPattern: 'read:*',
        effect: 'allow',
      }),
    ];
    const batch = evaluateEigenPolicyRulesPerCapability(
      rules,
      ['eigenx'],
      ['write:tool-capability'],
      ['operator'],
    );
    expect(batch.deniedCapabilityTags).toEqual(['write:tool-capability']);
    expect(batch.deniedReasonsByCapability['write:tool-capability']).toContain('No matching allow rule');
  });

  it('deduplicates capability tags', () => {
    const rules: EigenPolicyRule[] = [rule({ id: 'a', capabilityTagPattern: 'x' })];
    const batch = evaluateEigenPolicyRulesPerCapability(rules, ['eigenx'], ['  x  ', 'x'], ['member']);
    expect(batch.allowedCapabilityTags).toEqual(['x']);
  });
});
