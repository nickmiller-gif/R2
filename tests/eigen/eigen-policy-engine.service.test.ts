import { describe, expect, it } from 'vitest';
import {
  createEigenPolicyEngineService,
  type DbEigenPolicyRuleRow,
  type EigenPolicyEngineDb,
} from '../../src/services/eigen/policy-engine.service.js';

function makeRow(overrides: Partial<DbEigenPolicyRuleRow> = {}): DbEigenPolicyRuleRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    policy_tag: overrides.policy_tag ?? 'eigenx',
    capability_tag_pattern: overrides.capability_tag_pattern ?? '*',
    effect: overrides.effect ?? 'allow',
    required_role: overrides.required_role ?? null,
    rationale: overrides.rationale ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? '2026-04-13T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-13T00:00:00.000Z',
    is_active: overrides.is_active ?? true,
  };
}

function makeDb(rules: DbEigenPolicyRuleRow[]): EigenPolicyEngineDb {
  return {
    insertRule: async () => {
      throw new Error('not implemented for this test');
    },
    findRuleById: async () => {
      throw new Error('not implemented for this test');
    },
    queryRules: async (filter) => {
      if (!filter) return rules;
      return rules.filter((r) => {
        if (filter.policyTag && r.policy_tag !== filter.policyTag) return false;
        if (filter.effect && r.effect !== filter.effect) return false;
        if (filter.isActive === true && r.is_active === false) return false;
        if (filter.isActive === false && r.is_active !== false) return false;
        return true;
      });
    },
    updateRule: async () => {
      throw new Error('not implemented for this test');
    },
  };
}

describe('Eigen policy engine service', () => {
  it('applies deny-over-allow when both match', async () => {
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'allow-1',
          policy_tag: 'eigenx',
          capability_tag_pattern: '*',
          effect: 'allow',
        }),
        makeRow({
          id: 'deny-1',
          policy_tag: 'eigenx',
          capability_tag_pattern: 'write:*',
          effect: 'deny',
          rationale: 'write operations require explicit approval',
        }),
      ]),
    );

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:tool-capability'],
      callerRoles: ['operator'],
    });

    expect(result.allowed).toBe(false);
    expect(result.matchedRuleIds).toContain('allow-1');
    expect(result.matchedRuleIds).toContain('deny-1');
    expect(result.denyReasons).toContain('write operations require explicit approval');
  });

  it('treats admin as satisfying operator required_role', async () => {
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'allow-write-operator',
          policy_tag: 'eigenx',
          capability_tag_pattern: 'write:*',
          effect: 'allow',
          required_role: 'operator',
        }),
      ]),
    );

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:tool-capability'],
      callerRoles: ['admin'],
    });

    expect(result.allowed).toBe(true);
  });

  it('matches wildcard policy tags for user-scoped eigenx policies', async () => {
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'allow-user-scope',
          policy_tag: 'eigenx:*',
          capability_tag_pattern: 'read:*',
          effect: 'allow',
        }),
      ]),
    );

    const result = await service.evaluate({
      policyTags: ['eigenx:user:1234'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
    });

    expect(result.allowed).toBe(true);
    expect(result.matchedRuleIds).toEqual(['allow-user-scope']);
  });

  it('excludes superseded (is_active=false) rules from evaluation', async () => {
    // Operator superseded the broad allow with a tighter deny. The old allow
    // row stays in the table for audit, but evaluate() must ignore it; the
    // active deny should win.
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'allow-superseded',
          policy_tag: 'eigenx',
          capability_tag_pattern: 'write:*',
          effect: 'allow',
          is_active: false,
        }),
        makeRow({
          id: 'deny-active',
          policy_tag: 'eigenx',
          capability_tag_pattern: 'write:*',
          effect: 'deny',
          rationale: 'writes paused for review',
          is_active: true,
        }),
      ]),
    );

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:tool-capability'],
      callerRoles: ['operator'],
    });

    expect(result.allowed).toBe(false);
    expect(result.matchedRuleIds).not.toContain('allow-superseded');
    expect(result.matchedRuleIds).toContain('deny-active');
    expect(result.denyReasons).toContain('writes paused for review');
  });

  it('does not allow a superseded allow rule to gate access after rollover', async () => {
    // Standalone superseded allow with no replacement → access falls through
    // to the default deny ("No matching allow rule") rather than staying
    // permitted by the old row.
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'allow-retired',
          policy_tag: 'eigenx',
          capability_tag_pattern: 'read:*',
          effect: 'allow',
          is_active: false,
        }),
      ]),
    );

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
    });

    expect(result.allowed).toBe(false);
    expect(result.matchedRuleIds).toEqual([]);
    expect(result.denyReasons).toContain('No matching allow rule');
  });

  it('denies when no allow rule matches', async () => {
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'allow-read',
          policy_tag: 'eigenx',
          capability_tag_pattern: 'read:*',
          effect: 'allow',
        }),
      ]),
    );

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:tool-capability'],
      callerRoles: ['operator'],
    });

    expect(result.allowed).toBe(false);
    expect(result.denyReasons).toContain('No matching allow rule');
  });
});
