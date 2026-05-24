/**
 * Contract tests for the shared edge-runtime decision recorder, including
 * its wire-up via `enforceEigenKosCapabilityBundle`. The recorder closes the
 * audit gap that PR #296 (active-only rule filtering) hinted at but did not
 * itself address: production retrieve/chat/ingest paths now leave a row in
 * `eigen_policy_decisions` whenever an `audit` context is provided.
 *
 * The recorder talks to Supabase via `from('eigen_policy_decisions').insert(...).select('id').single()`
 * — the stub below answers that chain, captures the inserted row, and lets
 * tests assert what would have been persisted.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recordEigenPolicyBundleDecision,
  type RecordEigenPolicyBundleDecisionInput,
} from '../../supabase/functions/_shared/eigen-policy-decision-recorder.ts';
import { enforceEigenKosCapabilityBundle } from '../../supabase/functions/_shared/eigen-kos-enforcement.ts';

interface InsertedDecisionRow {
  allowed: boolean;
  policy_tags: string[];
  capability_tags: string[];
  caller_roles: string[];
  caller_subject: string | null;
  matched_rule_ids: string[];
  deny_reasons: string[];
  correlation_id: string | null;
  evaluation_ms: number | null;
  metadata: Record<string, unknown>;
}

interface FakeRuleRow {
  id: string;
  policy_tag: string;
  capability_tag_pattern: string;
  effect: 'allow' | 'deny';
  required_role: string | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function makeRule(overrides: Partial<FakeRuleRow> = {}): FakeRuleRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    policy_tag: overrides.policy_tag ?? 'eigenx',
    capability_tag_pattern: overrides.capability_tag_pattern ?? '*',
    effect: overrides.effect ?? 'allow',
    required_role: overrides.required_role ?? null,
    rationale: overrides.rationale ?? null,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? '2026-04-24T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-24T00:00:00.000Z',
  };
}

interface RecordingClient {
  client: SupabaseClient;
  inserted: InsertedDecisionRow[];
  /** Override the insert resolution to simulate DB failures. */
  setInsertOutcome(outcome: 'ok' | { error: unknown } | 'throw'): void;
}

/**
 * Stub Supabase client that handles two tables:
 *   - `eigen_policy_rules` (read) — answers the `.select(...)` chain used
 *     by the engine. The chain is both directly awaitable (current main —
 *     `await client.from(...).select(...)`) and `.eq()`-chainable
 *     (post-PR #296 — adds `.eq('is_active', true)` before await), so the
 *     stub keeps working through that merge without test churn.
 *   - `eigen_policy_decisions` (write) — answers `.insert([...]).select('id').single()`
 *     and stores the inserted row so tests can assert on it.
 */
function makeRecordingClient(rules: FakeRuleRow[]): RecordingClient {
  const inserted: InsertedDecisionRow[] = [];
  let outcome: 'ok' | { error: unknown } | 'throw' = 'ok';
  function makeRuleQuery(filtered: FakeRuleRow[]): {
    eq: (column: keyof FakeRuleRow, value: unknown) => ReturnType<typeof makeRuleQuery>;
    then: <T>(
      onFulfilled?: (value: { data: FakeRuleRow[]; error: null }) => T,
    ) => Promise<T | { data: FakeRuleRow[]; error: null }>;
  } {
    const result = { data: filtered, error: null as null };
    return {
      eq: (column, value) => makeRuleQuery(filtered.filter((row) => row[column] === value)),
      then: (onFulfilled) =>
        Promise.resolve(result).then(onFulfilled ?? ((v) => v as unknown as never)),
    };
  }
  const fake = {
    from(table: string) {
      if (table === 'eigen_policy_rules') {
        return {
          select: () => makeRuleQuery(rules),
        };
      }
      if (table === 'eigen_policy_decisions') {
        return {
          insert: (rows: InsertedDecisionRow[]) => ({
            select: () => ({
              single: () => {
                if (outcome === 'throw') {
                  throw new Error('simulated network blowup');
                }
                if (typeof outcome === 'object' && outcome !== null && 'error' in outcome) {
                  return Promise.resolve({ data: null, error: outcome.error });
                }
                const row = rows[0];
                inserted.push(row);
                return Promise.resolve({ data: { id: 'decision-id-1' }, error: null });
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table in recorder stub: ${table}`);
    },
  };
  return {
    client: fake as unknown as SupabaseClient,
    inserted,
    setInsertOutcome(next) {
      outcome = next;
    },
  };
}

const baseRecorderInput: RecordEigenPolicyBundleDecisionInput = {
  allowed: true,
  policyTags: ['eigenx'],
  capabilityTags: ['read:knowledge'],
  callerRoles: ['member'],
  matchedRuleIds: ['allow-read'],
  denyReasons: [],
  evaluationMs: 4,
  audit: {
    callerSubject: 'user-42',
    correlationId: 'req-abc',
    metadata: { trace: 'unit' },
  },
  surface: 'eigen-chat',
};

describe('recordEigenPolicyBundleDecision', () => {
  it('inserts the bundle outcome and returns the new decision id', async () => {
    const recording = makeRecordingClient([]);
    const id = await recordEigenPolicyBundleDecision(recording.client, baseRecorderInput);
    expect(id).toBe('decision-id-1');
    expect(recording.inserted).toHaveLength(1);
    expect(recording.inserted[0]).toMatchObject({
      allowed: true,
      caller_subject: 'user-42',
      correlation_id: 'req-abc',
      matched_rule_ids: ['allow-read'],
      deny_reasons: [],
      evaluation_ms: 4,
      // Surface attribution lives in metadata to avoid a schema migration —
      // operator queries already key off `metadata->>'surface'`.
      metadata: { trace: 'unit', surface: 'eigen-chat' },
    });
  });

  it('returns null and logs (does not throw) when insert reports a DB error', async () => {
    const recording = makeRecordingClient([]);
    recording.setInsertOutcome({ error: { message: 'check constraint failed' } });
    const onRecordError = vi.fn();
    const id = await recordEigenPolicyBundleDecision(recording.client, baseRecorderInput, {
      onRecordError,
    });
    expect(id).toBeNull();
    expect(onRecordError).toHaveBeenCalledOnce();
  });

  it('returns null and logs when the client itself throws (network blowup)', async () => {
    const recording = makeRecordingClient([]);
    recording.setInsertOutcome('throw');
    const onRecordError = vi.fn();
    const id = await recordEigenPolicyBundleDecision(recording.client, baseRecorderInput, {
      onRecordError,
    });
    expect(id).toBeNull();
    expect(onRecordError).toHaveBeenCalledOnce();
  });

  it('persists null caller_subject and correlation_id when audit omits them', async () => {
    const recording = makeRecordingClient([]);
    await recordEigenPolicyBundleDecision(recording.client, {
      ...baseRecorderInput,
      audit: {},
    });
    expect(recording.inserted[0]).toMatchObject({
      caller_subject: null,
      correlation_id: null,
      metadata: { surface: 'eigen-chat' },
    });
  });
});

describe('enforceEigenKosCapabilityBundle recording wire-up', () => {
  const memberRule = makeRule({
    id: 'allow-read-member',
    policy_tag: 'eigenx',
    capability_tag_pattern: 'read:*',
    effect: 'allow',
    required_role: 'member',
  });
  const aiAllow = makeRule({
    id: 'allow-ai-member',
    policy_tag: 'eigenx',
    capability_tag_pattern: 'ai:*',
    effect: 'allow',
    required_role: 'member',
  });
  const aiDeny = makeRule({
    id: 'deny-ai-incident',
    policy_tag: 'eigenx',
    capability_tag_pattern: 'ai:*',
    effect: 'deny',
    rationale: 'Synthesis paused during incident window.',
  });

  it('records one allow row when every required capability passes', async () => {
    const recording = makeRecordingClient([memberRule, aiAllow]);
    const result = await enforceEigenKosCapabilityBundle(recording.client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['read:knowledge', 'ai:synthesis'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
      audit: { callerSubject: 'user-42', correlationId: 'req-1' },
    });
    expect(result.ok).toBe(true);
    expect(recording.inserted).toHaveLength(1);
    const row = recording.inserted[0];
    expect(row.allowed).toBe(true);
    expect(row.deny_reasons).toEqual([]);
    expect(row.capability_tags.sort()).toEqual(['ai:synthesis', 'read:knowledge']);
    // Both candidate rules matched at least one capability — both should be
    // attributed in matched_rule_ids so an auditor can replay the decision.
    expect(row.matched_rule_ids.sort()).toEqual(['allow-ai-member', 'allow-read-member']);
    expect(row.evaluation_ms).toBeGreaterThanOrEqual(0);
  });

  it('records one deny row carrying the deny rationale under deny-over-allow', async () => {
    const recording = makeRecordingClient([memberRule, aiAllow, aiDeny]);
    const result = await enforceEigenKosCapabilityBundle(recording.client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['read:knowledge', 'ai:synthesis'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
      audit: { callerSubject: 'user-42', correlationId: 'req-2' },
    });
    expect(result.ok).toBe(false);
    expect(recording.inserted).toHaveLength(1);
    const row = recording.inserted[0];
    expect(row.allowed).toBe(false);
    expect(row.deny_reasons).toContain('Synthesis paused during incident window.');
    expect(row.matched_rule_ids).toEqual(
      expect.arrayContaining(['allow-read-member', 'allow-ai-member', 'deny-ai-incident']),
    );
  });

  it('skips recording when no `audit` context is supplied (rollout opt-in)', async () => {
    const recording = makeRecordingClient([memberRule]);
    const result = await enforceEigenKosCapabilityBundle(recording.client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['read:knowledge'],
      callerRoles: ['member'],
      surface: 'eigen-retrieve',
      // intentionally no audit
    });
    expect(result.ok).toBe(true);
    expect(recording.inserted).toEqual([]);
  });

  it('skips recording when the rollout backstop fires (rulesConfigured=false)', async () => {
    const recording = makeRecordingClient([]);
    const result = await enforceEigenKosCapabilityBundle(recording.client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['read:knowledge'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
      audit: { callerSubject: 'user-42', correlationId: 'req-3' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rulesConfigured).toBe(false);
    // Audit context was supplied, but there are no rules to attribute, so the
    // recorder must NOT emit a row — otherwise the audit table fills with
    // synthetic "allowed by absence" rows that hide real decisions.
    expect(recording.inserted).toEqual([]);
  });

  it('does not bubble recording failures into enforcement', async () => {
    const recording = makeRecordingClient([memberRule]);
    recording.setInsertOutcome('throw');
    const result = await enforceEigenKosCapabilityBundle(recording.client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['read:knowledge'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
      audit: { callerSubject: 'user-42', correlationId: 'req-4' },
    });
    // Recorder swallowed the simulated blowup — enforcement still returns
    // the real evaluation outcome rather than a 500.
    expect(result.ok).toBe(true);
    expect(recording.inserted).toEqual([]);
  });
});
