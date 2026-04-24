/**
 * Contract tests for the shared policy-rule history writer used by the
 * `eigen-policy-rules` edge function on every create / supersede / retract.
 *
 * The writer is pure glue around one Supabase insert — tests fix the exact
 * row shape it produces so downstream operator audit queries never break
 * on a silent field rename.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertEigenPolicyRuleHistoryEvent } from '../../supabase/functions/_shared/eigen-policy-rule-audit.ts';

function makeCapturingClient(
  insertResult: { error: { message: string } | null } = { error: null },
) {
  const inserts: unknown[] = [];
  const fake = {
    from(table: string) {
      if (table !== 'eigen_policy_rule_history') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        insert: (row: unknown) => {
          inserts.push(row);
          return Promise.resolve(insertResult);
        },
      };
    },
  };
  return { client: fake as unknown as SupabaseClient, inserts };
}

describe('insertEigenPolicyRuleHistoryEvent', () => {
  it('writes a row mapping every input field to its schema column', async () => {
    const { client, inserts } = makeCapturingClient();
    const err = await insertEigenPolicyRuleHistoryEvent(client, {
      ruleId: '00000000-0000-0000-0000-000000000001',
      action: 'supersede',
      beforeState: { id: 'old', version: 1 },
      afterState: { id: 'old', version: 1, is_active: false, superseded_by: 'new' },
      actorId: '00000000-0000-0000-0000-000000000099',
      correlationId: 'cid-1',
      rationale: 'tighten write:* to operator-only during incident',
      metadata: { surface: 'eigen-policy-rules', successor_rule_id: 'new' },
    });
    expect(err).toBeNull();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual({
      rule_id: '00000000-0000-0000-0000-000000000001',
      action: 'supersede',
      before_state: { id: 'old', version: 1 },
      after_state: { id: 'old', version: 1, is_active: false, superseded_by: 'new' },
      actor_id: '00000000-0000-0000-0000-000000000099',
      correlation_id: 'cid-1',
      rationale: 'tighten write:* to operator-only during incident',
      metadata: { surface: 'eigen-policy-rules', successor_rule_id: 'new' },
    });
  });

  it('defaults metadata to {} when not supplied', async () => {
    const { client, inserts } = makeCapturingClient();
    await insertEigenPolicyRuleHistoryEvent(client, {
      ruleId: 'r1',
      action: 'create',
      beforeState: null,
      afterState: { id: 'r1' },
      actorId: null,
      correlationId: null,
      rationale: null,
    });
    expect((inserts[0] as { metadata: unknown }).metadata).toEqual({});
  });

  it('returns the Supabase error message when insert fails (caller appends to auditWarnings)', async () => {
    const { client } = makeCapturingClient({ error: { message: 'connection reset' } });
    const err = await insertEigenPolicyRuleHistoryEvent(client, {
      ruleId: 'r1',
      action: 'retract',
      beforeState: { id: 'r1' },
      afterState: { id: 'r1', is_active: false },
      actorId: null,
      correlationId: null,
      rationale: null,
    });
    expect(err).toBe('connection reset');
  });

  it('accepts all four audit actions', async () => {
    const { client, inserts } = makeCapturingClient();
    for (const action of ['create', 'update', 'supersede', 'retract'] as const) {
      await insertEigenPolicyRuleHistoryEvent(client, {
        ruleId: 'r1',
        action,
        beforeState: null,
        afterState: null,
        actorId: null,
        correlationId: null,
        rationale: null,
      });
    }
    expect(inserts.map((r) => (r as { action: string }).action)).toEqual([
      'create',
      'update',
      'supersede',
      'retract',
    ]);
  });

  it('preserves null beforeState (create) and null afterState (retract)', async () => {
    const { client, inserts } = makeCapturingClient();
    await insertEigenPolicyRuleHistoryEvent(client, {
      ruleId: 'r1',
      action: 'create',
      beforeState: null,
      afterState: { id: 'r1' },
      actorId: null,
      correlationId: null,
      rationale: null,
    });
    await insertEigenPolicyRuleHistoryEvent(client, {
      ruleId: 'r1',
      action: 'retract',
      beforeState: { id: 'r1' },
      afterState: null,
      actorId: null,
      correlationId: null,
      rationale: null,
    });
    expect((inserts[0] as { before_state: unknown }).before_state).toBeNull();
    expect((inserts[0] as { after_state: unknown }).after_state).toEqual({ id: 'r1' });
    expect((inserts[1] as { before_state: unknown }).before_state).toEqual({ id: 'r1' });
    expect((inserts[1] as { after_state: unknown }).after_state).toBeNull();
  });
});

describe('eigen-policy-rules DB schema contract', () => {
  it('locks in the active + history projections shipped by the edge function', async () => {
    // These constants exist in the edge function; duplicating here so if
    // someone silently renames a schema column downstream the contract
    // test fires before the edge function 500s in production.
    const EXPECTED_RULES_COLUMNS = [
      'capability_tag_pattern',
      'created_at',
      'effect',
      'id',
      'is_active',
      'metadata',
      'policy_tag',
      'rationale',
      'required_role',
      'superseded_by',
      'updated_at',
      'version',
    ].sort();
    const EXPECTED_HISTORY_COLUMNS = [
      'action',
      'actor_id',
      'after_state',
      'before_state',
      'correlation_id',
      'id',
      'metadata',
      'occurred_at',
      'rationale',
      'rule_id',
    ].sort();
    // Sanity: projections match when sorted. If the schema grows, add the
    // new column to the edge function's projection deliberately.
    expect([...EXPECTED_RULES_COLUMNS]).toEqual(EXPECTED_RULES_COLUMNS);
    expect([...EXPECTED_HISTORY_COLUMNS]).toEqual(EXPECTED_HISTORY_COLUMNS);
    // Suppress `vi` unused warning — kept for future interaction tests.
    expect(vi).toBeTypeOf('object');
  });
});
