import { describe, expect, it } from 'vitest';
import {
  EigenPolicyRuleValidationError,
  normalizePolicyRuleInput,
  normalizePolicyRulePatch,
} from '../../src/lib/eigen/eigen-policy-eval.js';
import { EIGEN_POLICY_RULE_LIMITS } from '../../src/types/eigen/policy-engine.js';
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
    async queryRules() {
      return rows;
    },
    async updateRule(id, patch) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error(`Rule not found: ${id}`);
      rows[idx] = { ...rows[idx], ...patch };
      return rows[idx];
    },
  };
}

describe('normalizePolicyRuleInput', () => {
  it('trims whitespace from tag and pattern', () => {
    const result = normalizePolicyRuleInput({
      policyTag: '  eigenx  ',
      capabilityTagPattern: '\tread:*\n',
      rationale: '  reads everything  ',
      metadata: { source: 'seed' },
    });
    expect(result.policyTag).toBe('eigenx');
    expect(result.capabilityTagPattern).toBe('read:*');
    expect(result.rationale).toBe('reads everything');
    expect(result.metadata).toEqual({ source: 'seed' });
  });

  it('rejects empty-after-trim policy_tag', () => {
    expect(() =>
      normalizePolicyRuleInput({
        policyTag: '   ',
        capabilityTagPattern: 'read:*',
      }),
    ).toThrow(EigenPolicyRuleValidationError);
  });

  it('rejects empty-after-trim capability_tag_pattern', () => {
    expect(() =>
      normalizePolicyRuleInput({
        policyTag: 'eigenx',
        capabilityTagPattern: '',
      }),
    ).toThrow(EigenPolicyRuleValidationError);
  });

  it('rejects policy_tag exceeding the length bound', () => {
    expect(() =>
      normalizePolicyRuleInput({
        policyTag: 'x'.repeat(EIGEN_POLICY_RULE_LIMITS.POLICY_TAG_MAX + 1),
        capabilityTagPattern: 'read:*',
      }),
    ).toThrow(/exceeds maximum length/);
  });

  it('rejects capability_tag_pattern exceeding the length bound', () => {
    expect(() =>
      normalizePolicyRuleInput({
        policyTag: 'eigenx',
        capabilityTagPattern: 'x'.repeat(EIGEN_POLICY_RULE_LIMITS.CAPABILITY_TAG_PATTERN_MAX + 1),
      }),
    ).toThrow(/exceeds maximum length/);
  });

  it('rejects oversized metadata', () => {
    const oversized: Record<string, string> = {};
    const chunkSize = 100;
    const chunks = Math.ceil(EIGEN_POLICY_RULE_LIMITS.METADATA_BYTES_MAX / chunkSize) + 2;
    for (let i = 0; i < chunks; i += 1) {
      oversized[`k${i}`] = 'x'.repeat(chunkSize);
    }
    expect(() =>
      normalizePolicyRuleInput({
        policyTag: 'eigenx',
        capabilityTagPattern: 'read:*',
        metadata: oversized,
      }),
    ).toThrow(/metadata exceeds maximum size/);
  });

  it('rejects array metadata', () => {
    expect(() =>
      normalizePolicyRuleInput({
        policyTag: 'eigenx',
        capabilityTagPattern: 'read:*',
        metadata: [1, 2, 3] as unknown as Record<string, unknown>,
      }),
    ).toThrow(/metadata must be a JSON object/);
  });

  it('normalizes empty rationale to null', () => {
    const result = normalizePolicyRuleInput({
      policyTag: 'eigenx',
      capabilityTagPattern: 'read:*',
      rationale: '   ',
    });
    expect(result.rationale).toBeNull();
  });
});

describe('normalizePolicyRulePatch', () => {
  it('only includes fields that are explicitly provided', () => {
    const patch = normalizePolicyRulePatch({ capabilityTagPattern: 'write:*' });
    expect(patch).toEqual({ capabilityTagPattern: 'write:*' });
    expect('policyTag' in patch).toBe(false);
  });

  it('preserves explicit null rationale so callers can clear it', () => {
    const patch = normalizePolicyRulePatch({ rationale: null });
    expect('rationale' in patch).toBe(true);
    expect(patch.rationale).toBeNull();
  });

  it('applies the same length bounds as create', () => {
    expect(() =>
      normalizePolicyRulePatch({
        policyTag: 'x'.repeat(EIGEN_POLICY_RULE_LIMITS.POLICY_TAG_MAX + 1),
      }),
    ).toThrow(EigenPolicyRuleValidationError);
  });
});

describe('EigenPolicyEngineService validation', () => {
  it('trims and stores normalized fields on create', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);
    const rule = await service.createRule({
      policyTag: '  eigenx  ',
      capabilityTagPattern: '  read:*  ',
      effect: 'allow',
      rationale: '  reads allowed  ',
    });
    expect(rule.policyTag).toBe('eigenx');
    expect(rule.capabilityTagPattern).toBe('read:*');
    expect(rule.rationale).toBe('reads allowed');
  });

  it('rejects create with empty policy_tag', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);
    await expect(
      service.createRule({
        policyTag: '   ',
        capabilityTagPattern: 'read:*',
        effect: 'allow',
      }),
    ).rejects.toBeInstanceOf(EigenPolicyRuleValidationError);
  });

  it('rejects update with overlength pattern', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);
    const rule = await service.createRule({
      policyTag: 'eigenx',
      capabilityTagPattern: 'read:*',
      effect: 'allow',
    });
    await expect(
      service.updateRule(rule.id, {
        capabilityTagPattern: 'x'.repeat(EIGEN_POLICY_RULE_LIMITS.CAPABILITY_TAG_PATTERN_MAX + 1),
      }),
    ).rejects.toBeInstanceOf(EigenPolicyRuleValidationError);
  });

  it('allows clearing rationale to null via update', async () => {
    const db = makeMockDb();
    const service = createEigenPolicyEngineService(db);
    const rule = await service.createRule({
      policyTag: 'eigenx',
      capabilityTagPattern: 'read:*',
      effect: 'allow',
      rationale: 'remove me',
    });
    const updated = await service.updateRule(rule.id, { rationale: null });
    expect(updated.rationale).toBeNull();
  });
});
