import { describe, expect, it } from 'vitest';
import {
  createEigenPolicyEngineService,
  type DbEigenPolicyRuleRow,
  type EigenPolicyEngineDb,
} from '../../src/services/eigen/policy-engine.service.js';

function makeMockDb(): EigenPolicyEngineDb & { rows: DbEigenPolicyRuleRow[] } {
  const rows: DbEigenPolicyRuleRow[] = [];
  return {
    rows,
    async insertRule(row) {
      rows.push(row);
      return row;
    },
    async findRuleById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async queryRules(filter) {
      return rows.filter((r) => {
        if (!filter) return true;
        if (filter.policyTag && r.policy_tag !== filter.policyTag) return false;
        if (filter.effect && r.effect !== filter.effect) return false;
        return true;
      });
    },
    async updateRule(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error(`Rule not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('EigenPolicyEngineService', () => {
  it('allows when matching allow rule exists', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);

    await service.createRule({
      policyTag: 'eigenx',
      capabilityTagPattern: 'retrieval:*',
      effect: 'allow',
    });

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['retrieval:query'],
      callerRoles: ['member'],
    });
    expect(result.allowed).toBe(true);
    expect(result.denyReasons).toEqual([]);
  });

  it('denies when deny rule matches', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);

    await service.createRule({
      policyTag: 'eigenx',
      capabilityTagPattern: 'write:*',
      effect: 'deny',
      rationale: 'write access disabled',
    });

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:index'],
      callerRoles: ['operator'],
    });
    expect(result.allowed).toBe(false);
    expect(result.denyReasons[0]).toContain('write access disabled');
  });

  it('respects requiredRole when evaluating matching rules', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);

    await service.createRule({
      policyTag: 'eigenx',
      capabilityTagPattern: 'retrieve:*',
      effect: 'allow',
      requiredRole: 'operator',
      rationale: 'operators can retrieve private context',
    });

    const withoutRole = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['retrieve:query'],
      callerRoles: ['member'],
    });
    expect(withoutRole.allowed).toBe(false);
    expect(withoutRole.denyReasons).toEqual(['No matching allow rule']);

    const withRole = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['retrieve:query'],
      callerRoles: ['member', 'operator'],
    });
    expect(withRole.allowed).toBe(true);
    expect(withRole.denyReasons).toEqual([]);
  });

  it('persists metadata on create and update', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);

    const created = await service.createRule({
      policyTag: 'eigen_public',
      capabilityTagPattern: 'chat:*',
      effect: 'allow',
      metadata: { source: 'seed', version: 1 },
    });
    expect(created.metadata).toEqual({ source: 'seed', version: 1 });

    const updated = await service.updateRule(created.id, {
      metadata: { source: 'runtime', rollout: 'phase-c3' },
    });
    expect(updated.metadata).toEqual({ source: 'runtime', rollout: 'phase-c3' });
  });
});

