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
    queryRules: async () => rules,
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

  it('passes isActive=true when evaluating so superseded rules cannot match', async () => {
    // The migration 202604240006 supersede flow keeps retired rows in the
    // table with is_active=false. evaluate() must request only active rules
    // — otherwise a retracted deny would silently keep blocking traffic.
    const seenFilters: Array<{ isActive?: boolean } | undefined> = [];
    const activeAllow = makeRow({
      id: 'allow-active',
      policy_tag: 'eigenx',
      capability_tag_pattern: 'ai:*',
      effect: 'allow',
    });
    const supersededDeny = makeRow({
      id: 'deny-superseded',
      policy_tag: 'eigenx',
      capability_tag_pattern: 'ai:*',
      effect: 'deny',
      rationale: 'Superseded incident-window deny; must not block.',
    });
    const db: EigenPolicyEngineDb = {
      insertRule: async () => {
        throw new Error('not implemented');
      },
      findRuleById: async () => null,
      queryRules: async (filter) => {
        seenFilters.push(filter);
        // Emulate eigen_policy_rules_active_read_model: when callers ask for
        // active rules, the superseded row is filtered out.
        if (filter?.isActive === true) return [activeAllow];
        return [activeAllow, supersededDeny];
      },
      updateRule: async () => {
        throw new Error('not implemented');
      },
    };
    const service = createEigenPolicyEngineService(db);

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['ai:synthesis'],
      callerRoles: ['member'],
    });

    expect(seenFilters).toEqual([{ isActive: true }]);
    expect(result.allowed).toBe(true);
    expect(result.matchedRuleIds).toEqual(['allow-active']);
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
