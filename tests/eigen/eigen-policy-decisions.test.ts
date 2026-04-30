import { describe, expect, it, vi } from 'vitest';
import {
  createEigenPolicyEngineService,
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

describe('Eigen policy decision audit-write bounds', () => {
  it('truncates oversized tag arrays + over-long tag strings and notes the cuts in metadata', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    const longTag = 'x'.repeat(500);
    const policyTags = Array.from({ length: 50 }, (_, i) => `pt-${i}`);
    const capabilityTags = [longTag, ...Array.from({ length: 40 }, (_, i) => `cap-${i}`)];

    await service.evaluate({ policyTags, capabilityTags, callerRoles: ['member'] });

    expect(db.recorded).toHaveLength(1);
    const row = db.recorded[0];
    // Array dropped to cap (32).
    expect(row.policy_tags).toHaveLength(32);
    expect(row.capability_tags).toHaveLength(32);
    // First-element-clamped to per-string cap (256).
    expect(row.capability_tags[0]).toHaveLength(256);
    expect(row.metadata).toMatchObject({
      __decision_truncations: {
        policy_tags_dropped: 18,
        capability_tags_dropped: 9,
        capability_tags_clamped: 1,
      },
    });
  });

  it('truncates over-long caller_subject and correlation_id and clamps oversized roles array', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: Array.from({ length: 30 }, (_, i) => `role-${i}`),
      callerSubject: 's'.repeat(1000),
      correlationId: 'c'.repeat(500),
    });

    const row = db.recorded[0];
    expect(row.caller_roles).toHaveLength(16);
    expect(row.caller_subject).toHaveLength(256);
    expect(row.correlation_id).toHaveLength(128);
    expect(row.metadata).toMatchObject({
      __decision_truncations: {
        caller_roles_dropped: 14,
        caller_subject_clamped: true,
        correlation_id_clamped: true,
      },
    });
  });

  it('replaces metadata that exceeds the byte cap with a marker and records original size', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    const huge = { blob: 'z'.repeat(20_000) };
    await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
      metadata: huge,
    });

    const row = db.recorded[0];
    expect(row.metadata.blob).toBeUndefined();
    expect(row.metadata.__replaced).toBe(true);
    expect(typeof row.metadata.__original_bytes).toBe('number');
    expect(row.metadata.__original_bytes as number).toBeGreaterThan(20_000);
    expect(row.metadata).toMatchObject({
      __decision_truncations: { metadata_replaced: true },
    });
  });

  it('does not annotate metadata when no truncation occurred', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
      metadata: { source: 'test' },
    });

    const row = db.recorded[0];
    expect(row.metadata).toEqual({ source: 'test' });
    expect((row.metadata as Record<string, unknown>).__decision_truncations).toBeUndefined();
  });

  it('truncates matched_rule_ids and deny_reasons when an evaluator returns pathological output', async () => {
    // Synthesize an evaluator-output shape with too many entries by stuffing
    // many deny rules. Each deny rule contributes one matched-rule-id and
    // one deny-reason; we want both to exceed 256.
    const overflow = 300;
    const rules: DbEigenPolicyRuleRow[] = Array.from({ length: overflow }, (_, i) =>
      makeRow({
        id: `deny-${i}`,
        capability_tag_pattern: '*',
        effect: 'deny',
        rationale: `r${i}`,
      }),
    );
    const db = makeRecordingDb(rules);
    const service = createEigenPolicyEngineService(db);

    await service.evaluate({
      policyTags: ['eigenx'],
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
    });

    const row = db.recorded[0];
    expect(row.matched_rule_ids).toHaveLength(256);
    expect(row.deny_reasons).toHaveLength(256);
    expect(row.metadata).toMatchObject({
      __decision_truncations: {
        matched_rule_ids_dropped: overflow - 256,
        deny_reasons_dropped: overflow - 256,
      },
    });
  });

  it('clamps negative wall-clock evaluation_ms (clock skew safety) to zero', async () => {
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValueOnce(1_000); // started_at
    dateSpy.mockReturnValueOnce(500); // ended_at — backwards (clock-skew)

    try {
      await service.evaluate({
        policyTags: ['eigenx'],
        capabilityTags: ['read:tool-capability'],
        callerRoles: ['member'],
      });
    } finally {
      dateSpy.mockRestore();
    }

    expect(db.recorded[0].evaluation_ms).toBe(0);
  });

  it('preserves caller-supplied truncation marker key only as an internal annotation', async () => {
    // If a caller sneaks the truncation marker key into their metadata, the
    // bounder still overwrites it with the authoritative truncation summary.
    const db = makeRecordingDb([
      makeRow({ id: 'allow-all', capability_tag_pattern: '*', effect: 'allow' }),
    ]);
    const service = createEigenPolicyEngineService(db);

    await service.evaluate({
      policyTags: Array.from({ length: 50 }, (_, i) => `pt-${i}`),
      capabilityTags: ['read:tool-capability'],
      callerRoles: ['member'],
      metadata: { __decision_truncations: { fake: 999 }, real: 'data' },
    });

    const row = db.recorded[0];
    const truncations = (row.metadata as Record<string, unknown>).__decision_truncations as Record<
      string,
      unknown
    >;
    expect(truncations.fake).toBeUndefined();
    expect(truncations.policy_tags_dropped).toBe(18);
    expect(row.metadata.real).toBe('data');
  });
});
