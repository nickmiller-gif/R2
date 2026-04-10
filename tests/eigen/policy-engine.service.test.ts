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
});

