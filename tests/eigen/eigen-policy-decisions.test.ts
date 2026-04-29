import { describe, expect, it, vi } from 'vitest';
import {
  createEigenPolicyEngineService,
  EIGEN_DECISION_BOUNDS,
  type DbEigenPolicyDecisionRow,
  type DbEigenPolicyRuleRow,
  type EigenPolicyEngineDb,
} from '../../src/services/eigen/policy-engine.service.js';
import type { EigenPolicyDecisionFilter } from '../../src/types/eigen/policy-engine.js';

function makeRow(overrides: Partial<DbEigenPolicyRuleRow> = {}): DbEigenPolicyRuleRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    policy_tag: overrides.policy_tag ?? 'eigenx',
    capability_tag_pattern: overrides.capability_tag_pattern ?? '*',
    effect: overrides.effect ?? 'allow',
    required_role: overrides.required_role ?? null,
    rationale: overrides.rationale ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? '2026-04-29T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-29T00:00:00.000Z',
  };
}

interface RecordingDb extends EigenPolicyEngineDb {
  recorded: DbEigenPolicyDecisionRow[];
}

function makeRecordingDb(rules: DbEigenPolicyRuleRow[]): RecordingDb {
  const recorded: DbEigenPolicyDecisionRow[] = [];
  return {
    recorded,
    insertRule: async () => {
      throw new Error('not used');
    },
    findRuleById: async () => null,
    queryRules: async () => rules,
    updateRule: async () => {
      throw new Error('not used');
    },
    insertDecision: async (row) => {
      recorded.push(row);
      return row;
    },
    queryDecisions: async (filter?: EigenPolicyDecisionFilter) => {
      let out = [...recorded];
      if (filter?.allowed !== undefined) {
        out = out.filter((r) => r.allowed === filter.allowed);
      }
      if (filter?.callerSubject) {
        out = out.filter((r) => r.caller_subject === filter.callerSubject);
      }
      if (filter?.correlationId) {
        out = out.filter((r) => r.correlation_id === filter.correlationId);
      }
      if (filter?.matchedRuleId) {
        out = out.filter((r) => r.matched_rule_ids.includes(filter.matchedRuleId!));
      }
      if (filter?.limit !== undefined) out = out.slice(0, filter.limit);
      return out;
    },
  };
}

describe('Eigen policy decision recording', () => {
  it('records an allow decision with subject + correlation context and returns decisionId', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-read', capability_tag_pattern: 'read:*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
      callerSubject: 'user-42',
      correlationId: 'req-abc',
      metadata: { source: 'eigen-retrieve' },
    });

    expect(result.allowed).toBe(true);
    expect(result.decisionId).toBeDefined();
    expect(result.evaluationMs).toBeGreaterThanOrEqual(0);
    expect(db.recorded).toHaveLength(1);
    expect(db.recorded[0]).toMatchObject({
      allowed: true,
      caller_subject: 'user-42',
      correlation_id: 'req-abc',
      matched_rule_ids: ['allow-read'],
      metadata: { source: 'eigen-retrieve' },
    });
    expect(db.recorded[0].id).toBe(result.decisionId);
  });

  it('records a deny decision with the deny rationale', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
      makeRow({
        id: 'deny-write',
        capability_tag_pattern: 'write:*',
        effect: 'deny',
        rationale: 'writes require approval',
      }),
    ]);
    const service = createEigenPolicyEngineService(db);

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:tool-capability'],
      callerRoles: ['operator'],
    });

    expect(result.allowed).toBe(false);
    expect(db.recorded[0].allowed).toBe(false);
    expect(db.recorded[0].deny_reasons).toContain('writes require approval');
    expect(db.recorded[0].matched_rule_ids).toEqual(
      expect.arrayContaining(['allow-all', 'deny-write']),
    );
  });

  it('skips recording (no decisionId) when DB does not support insertDecision', async () => {
    const minimalDb: EigenPolicyEngineDb = {
      insertRule: async () => {
        throw new Error('not used');
      },
      findRuleById: async () => null,
      queryRules: async () => [
        makeRow({ id: 'allow-read', capability_tag_pattern: 'read:*', effect: 'allow' }),
      ],
      updateRule: async () => {
        throw new Error('not used');
      },
    };
    const service = createEigenPolicyEngineService(minimalDb);

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
    });

    expect(result.allowed).toBe(true);
    expect(result.decisionId).toBeUndefined();
    expect(result.evaluationMs).toBeUndefined();
  });

  it('returns the evaluation result even when recording throws (best-effort audit)', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-read', capability_tag_pattern: 'read:*', effect: 'allow' }),
    ]);
    db.insertDecision = async () => {
      throw new Error('db down');
    };
    const onRecordError = vi.fn();
    const service = createEigenPolicyEngineService(db, { onRecordError });

    const result = await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
    });

    expect(result.allowed).toBe(true);
    expect(result.decisionId).toBeUndefined();
    expect(result.evaluationMs).toBeGreaterThanOrEqual(0);
    expect(onRecordError).toHaveBeenCalledOnce();
  });

  it('listDecisions filters by allowed, subject, correlation, and matched rule', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-read', capability_tag_pattern: 'read:*', effect: 'allow' }),
      makeRow({
        id: 'deny-write',
        capability_tag_pattern: 'write:*',
        effect: 'deny',
        rationale: 'no',
      }),
    ]);
    const service = createEigenPolicyEngineService(db);

    await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
      callerSubject: 'user-1',
      correlationId: 'req-1',
    });
    await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['write:tool-capability'],
      callerRoles: ['operator'],
      callerSubject: 'user-2',
      correlationId: 'req-2',
    });

    const denies = await service.listDecisions({ allowed: false });
    expect(denies).toHaveLength(1);
    expect(denies[0].callerSubject).toBe('user-2');

    const bySubject = await service.listDecisions({ callerSubject: 'user-1' });
    expect(bySubject).toHaveLength(1);
    expect(bySubject[0].correlationId).toBe('req-1');

    const byRule = await service.listDecisions({ matchedRuleId: 'deny-write' });
    expect(byRule).toHaveLength(1);
    expect(byRule[0].allowed).toBe(false);
  });

  it('listDecisions throws clearly when DB does not support reads', async () => {
    const db = makeRecordingDb([]);
    db.queryDecisions = undefined;
    const service = createEigenPolicyEngineService(db);

    await expect(service.listDecisions()).rejects.toThrow(/queryDecisions/);
  });

  it('listDecisions caps unbounded scans with a default and a hard max', async () => {
    const db = makeRecordingDb([]);
    const seenLimits: Array<number | undefined> = [];
    db.queryDecisions = async (filter) => {
      seenLimits.push(filter?.limit);
      return [];
    };
    const service = createEigenPolicyEngineService(db);

    await service.listDecisions();
    await service.listDecisions({ limit: 50 });
    await service.listDecisions({ limit: 10_000 });

    expect(seenLimits).toEqual([100, 50, 1000]);
  });

  it('listDecisions clamps non-positive limits to at least 1 (LIMIT -1 disables limiting in Postgres)', async () => {
    const db = makeRecordingDb([]);
    const seenLimits: Array<number | undefined> = [];
    db.queryDecisions = async (filter) => {
      seenLimits.push(filter?.limit);
      return [];
    };
    const service = createEigenPolicyEngineService(db);

    await service.listDecisions({ limit: 0 });
    await service.listDecisions({ limit: -1 });
    await service.listDecisions({ limit: -10_000 });

    expect(seenLimits).toEqual([1, 1, 1]);
  });
});

describe('Eigen policy evaluate() input bounds (defense in depth)', () => {
  function setup(): {
    service: ReturnType<typeof createEigenPolicyEngineService>;
    db: ReturnType<typeof makeRecordingDb>;
  } {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);
    return { service, db };
  }

  const baseInput = {
    policyTags: ['eigenx'],
    capabilityTags: ['read:tool-capability'],
    callerRoles: ['member'],
  };

  it('rejects oversized policyTags cardinality without inserting a decision row', async () => {
    const { service, db } = setup();
    const tooMany = Array.from(
      { length: EIGEN_DECISION_BOUNDS.policyTagsMax + 1 },
      (_, i) => `t${i}`,
    );
    await expect(service.evaluate({ ...baseInput, policyTags: tooMany })).rejects.toThrow(
      /policyTags cardinality/,
    );
    expect(db.recorded).toHaveLength(0);
  });

  it('rejects oversized capabilityTags cardinality', async () => {
    const { service } = setup();
    const tooMany = Array.from(
      { length: EIGEN_DECISION_BOUNDS.capabilityTagsMax + 1 },
      (_, i) => `c${i}`,
    );
    await expect(service.evaluate({ ...baseInput, capabilityTags: tooMany })).rejects.toThrow(
      /capabilityTags cardinality/,
    );
  });

  it('rejects oversized callerRoles cardinality', async () => {
    const { service } = setup();
    const tooMany = Array.from(
      { length: EIGEN_DECISION_BOUNDS.callerRolesMax + 1 },
      (_, i) => `r${i}`,
    );
    await expect(service.evaluate({ ...baseInput, callerRoles: tooMany })).rejects.toThrow(
      /callerRoles cardinality/,
    );
  });

  it('rejects oversized individual tag length', async () => {
    const { service } = setup();
    const huge = 'x'.repeat(EIGEN_DECISION_BOUNDS.policyTagMaxLength + 1);
    await expect(service.evaluate({ ...baseInput, policyTags: [huge] })).rejects.toThrow(
      /policyTags entry length/,
    );
  });

  it('rejects oversized callerSubject length', async () => {
    const { service } = setup();
    const huge = 's'.repeat(EIGEN_DECISION_BOUNDS.callerSubjectMaxLength + 1);
    await expect(service.evaluate({ ...baseInput, callerSubject: huge })).rejects.toThrow(
      /callerSubject length/,
    );
  });

  it('rejects oversized correlationId length', async () => {
    const { service } = setup();
    const huge = 'c'.repeat(EIGEN_DECISION_BOUNDS.correlationIdMaxLength + 1);
    await expect(service.evaluate({ ...baseInput, correlationId: huge })).rejects.toThrow(
      /correlationId length/,
    );
  });

  it('rejects metadata that exceeds the JSON byte cap', async () => {
    const { service, db } = setup();
    // Each char is ~1 byte once JSON-encoded; pad slightly over the cap.
    const blob = 'a'.repeat(EIGEN_DECISION_BOUNDS.metadataMaxJsonBytes + 1);
    await expect(service.evaluate({ ...baseInput, metadata: { blob } })).rejects.toThrow(
      /metadata JSON byte length/,
    );
    expect(db.recorded).toHaveLength(0);
  });

  it('accepts inputs at the boundary (cap-equal) without throwing', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-star', policy_tag: '*', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    const result = await service.evaluate({
      policyTags: Array.from({ length: EIGEN_DECISION_BOUNDS.policyTagsMax }, (_, i) => `t${i}`),
      capabilityTags: Array.from(
        { length: EIGEN_DECISION_BOUNDS.capabilityTagsMax },
        (_, i) => `c${i}`,
      ),
      callerRoles: Array.from({ length: EIGEN_DECISION_BOUNDS.callerRolesMax }, (_, i) => `r${i}`),
      callerSubject: 's'.repeat(EIGEN_DECISION_BOUNDS.callerSubjectMaxLength),
      correlationId: 'c'.repeat(EIGEN_DECISION_BOUNDS.correlationIdMaxLength),
    });
    expect(result.allowed).toBe(true);
    expect(db.recorded).toHaveLength(1);
  });
});
