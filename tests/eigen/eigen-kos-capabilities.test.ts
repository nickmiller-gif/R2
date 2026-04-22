import { describe, expect, it } from 'vitest';
import { EIGEN_KOS_CAPABILITY } from '../../src/lib/eigen/eigen-kos-capabilities.js';
import {
  createEigenPolicyEngineService,
  type DbEigenPolicyRuleRow,
  type EigenPolicyEngineDb,
} from '../../src/services/eigen/policy-engine.service.js';

function makeRow(overrides: Partial<DbEigenPolicyRuleRow> = {}): DbEigenPolicyRuleRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    policy_tag: overrides.policy_tag ?? 'eigen_public',
    capability_tag_pattern: overrides.capability_tag_pattern ?? 'read:*',
    effect: overrides.effect ?? 'allow',
    required_role: overrides.required_role ?? 'member',
    rationale: overrides.rationale ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? '2026-04-24T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-24T00:00:00.000Z',
  };
}

function makeDb(rules: DbEigenPolicyRuleRow[]): EigenPolicyEngineDb {
  return {
    insertRule: async () => {
      throw new Error('not implemented');
    },
    findRuleById: async () => {
      throw new Error('not implemented');
    },
    queryRules: async () => rules,
    updateRule: async () => {
      throw new Error('not implemented');
    },
  };
}

describe('Eigen KOS capability constants', () => {
  it('includes tags aligned with tool_capabilities action rows', () => {
    expect(EIGEN_KOS_CAPABILITY.retrieve).toContain('search');
    expect(EIGEN_KOS_CAPABILITY.retrieve).toContain('read:knowledge');
    expect(EIGEN_KOS_CAPABILITY.chat).toContain('ai:synthesis');
    expect(EIGEN_KOS_CAPABILITY.ingest).toContain('write:document');
    expect(EIGEN_KOS_CAPABILITY.ingest).toContain('ingest');
  });
});

describe('Eigen public corpus policy (seeded migration 202604240002)', () => {
  it('allows member read bundle on eigen_public', async () => {
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'pub-read',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'read:*',
          required_role: 'member',
        }),
        makeRow({
          id: 'pub-search',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'search',
          required_role: 'member',
        }),
        makeRow({
          id: 'pub-ai',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'ai:*',
          required_role: 'member',
        }),
        makeRow({
          id: 'pub-write',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'write:*',
          required_role: 'operator',
        }),
      ]),
    );

    for (const tag of EIGEN_KOS_CAPABILITY.retrieve) {
      const r = await service.evaluate({
        policyTags: ['eigen_public'],
        capabilityTags: [tag],
        callerRoles: ['member'],
      });
      expect(r.allowed, tag).toBe(true);
    }
  });

  it('denies member ingest write bundle on eigen_public', async () => {
    const service = createEigenPolicyEngineService(
      makeDb([
        makeRow({
          id: 'pub-read',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'read:*',
          required_role: 'member',
        }),
        makeRow({
          id: 'pub-search',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'search',
          required_role: 'member',
        }),
        makeRow({
          id: 'pub-ai',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'ai:*',
          required_role: 'member',
        }),
        makeRow({
          id: 'pub-write',
          policy_tag: 'eigen_public',
          capability_tag_pattern: 'write:*',
          required_role: 'operator',
        }),
      ]),
    );

    const r = await service.evaluate({
      policyTags: ['eigen_public'],
      capabilityTags: ['write:knowledge'],
      callerRoles: ['member'],
    });
    expect(r.allowed).toBe(false);
  });
});
