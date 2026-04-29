/**
 * Contract tests for the shared KOS capability-bundle enforcement helper used
 * by every sensitive eigen edge function (retrieve, chat, widget-chat-eigenx).
 *
 * The helper queries `eigen_policy_rules` via a Supabase client, so we provide
 * a minimal chainable stub that returns the rule set we want to test against
 * and covers the four contract cases:
 *   1. No rules configured → pass through with `ok: true, rulesConfigured: false`.
 *   2. All bundle capabilities allowed → `ok: true, rulesConfigured: true`.
 *   3. Any capability denied → `ok: false` with stable denial payload shape.
 *   4. Empty required tag bundle → short-circuits to allow (helper is a no-op).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildEigenKosCapabilityDenialBody,
  enforceEigenKosCapabilityBundle,
} from '../../supabase/functions/_shared/eigen-kos-enforcement.ts';
import { clearEigenPolicyRulesCache } from '../../supabase/functions/_shared/eigen-policy-engine.ts';

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

function makeRuleRow(overrides: Partial<FakeRuleRow> = {}): FakeRuleRow {
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

/**
 * Minimal Supabase client stub that answers the one query the helper runs:
 * `client.from('eigen_policy_rules').select(...)` returns the rule set.
 */
function makeFakeClient(rules: FakeRuleRow[]): SupabaseClient {
  const selectResult = { data: rules, error: null };
  const fake = {
    from(table: string) {
      if (table !== 'eigen_policy_rules') {
        throw new Error(`Unexpected table in KOS enforcement stub: ${table}`);
      }
      return {
        select: () => Promise.resolve(selectResult),
      };
    },
  };
  // The helper only touches `.from().select()`, so casting through `unknown` is safe
  // for a contract-level stub.
  return fake as unknown as SupabaseClient;
}

describe('enforceEigenKosCapabilityBundle', () => {
  beforeEach(() => {
    clearEigenPolicyRulesCache();
  });

  it('short-circuits to allow when no rules are configured (rollout backstop)', async () => {
    const client = makeFakeClient([]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['search', 'read:knowledge', 'ai:synthesis'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rulesConfigured).toBe(false);
  });

  it('allows a bundle when every required capability matches an allow rule', async () => {
    const client = makeFakeClient([
      makeRuleRow({
        id: 'allow-all-read',
        policy_tag: 'eigenx',
        capability_tag_pattern: '*',
        required_role: 'member',
      }),
    ]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['search', 'read:knowledge', 'ai:synthesis'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rulesConfigured).toBe(true);
      expect(result.allowedCapabilityTags.sort()).toEqual(
        ['ai:synthesis', 'read:knowledge', 'search'].sort(),
      );
    }
  });

  it('denies the bundle if any required capability has no matching allow rule', async () => {
    const client = makeFakeClient([
      makeRuleRow({
        id: 'allow-read-only',
        policy_tag: 'eigenx',
        capability_tag_pattern: 'read:*',
        required_role: 'member',
      }),
      // Intentionally omit any rule that covers `ai:synthesis` or `search`.
    ]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['search', 'read:knowledge', 'ai:synthesis'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.denial.surface).toBe('eigen-chat');
      expect(result.denial.deniedCapabilityTags.sort()).toEqual(['ai:synthesis', 'search'].sort());
      expect(result.denial.deniedReasonsByCapability['search']).toContain('No matching allow rule');
    }
  });

  it('denies when a broader deny rule overrides an allow (deny-over-allow)', async () => {
    const client = makeFakeClient([
      makeRuleRow({
        id: 'allow-read',
        policy_tag: 'eigenx',
        capability_tag_pattern: 'read:*',
        effect: 'allow',
        required_role: 'member',
      }),
      makeRuleRow({
        id: 'deny-ai',
        policy_tag: 'eigenx',
        capability_tag_pattern: 'ai:*',
        effect: 'deny',
        rationale: 'Synthesis requires operator review during incident window.',
      }),
      makeRuleRow({
        id: 'allow-search',
        policy_tag: 'eigenx',
        capability_tag_pattern: 'search',
        effect: 'allow',
        required_role: 'member',
      }),
      makeRuleRow({
        id: 'allow-ai',
        policy_tag: 'eigenx',
        capability_tag_pattern: 'ai:*',
        effect: 'allow',
        required_role: 'member',
      }),
    ]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['search', 'read:knowledge', 'ai:synthesis'],
      callerRoles: ['member'],
      surface: 'eigen-chat',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.denial.deniedCapabilityTags).toEqual(['ai:synthesis']);
      expect(result.denial.deniedReasonsByCapability['ai:synthesis']).toContain(
        'Synthesis requires operator review during incident window.',
      );
    }
  });

  it('treats an empty required capability bundle as trivially allowed', async () => {
    const client = makeFakeClient([
      makeRuleRow({ id: 'any-deny', effect: 'deny', capability_tag_pattern: '*' }),
    ]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: [],
      callerRoles: ['member'],
      surface: 'eigen-retrieve',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rulesConfigured).toBe(false);
      expect(result.allowedCapabilityTags).toEqual([]);
    }
  });

  it('denies when the caller role does not satisfy the rule requirement', async () => {
    const client = makeFakeClient([
      makeRuleRow({
        id: 'allow-for-operator',
        policy_tag: 'eigenx',
        capability_tag_pattern: '*',
        effect: 'allow',
        required_role: 'operator',
      }),
    ]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['search', 'read:knowledge'],
      callerRoles: ['member'],
      surface: 'eigen-retrieve',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.denial.deniedCapabilityTags.sort()).toEqual(
        ['read:knowledge', 'search'].sort(),
      );
    }
  });

  it('normalizes duplicate / whitespace-only required tags before evaluation', async () => {
    const client = makeFakeClient([
      makeRuleRow({
        id: 'allow-read',
        policy_tag: 'eigenx',
        capability_tag_pattern: 'read:*',
        effect: 'allow',
        required_role: 'member',
      }),
    ]);
    const result = await enforceEigenKosCapabilityBundle(client, {
      policyTags: ['eigenx'],
      requiredCapabilityTags: ['read:knowledge', 'read:knowledge', '  ', ''],
      callerRoles: ['member'],
      surface: 'eigen-retrieve',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.allowedCapabilityTags).toEqual(['read:knowledge']);
    }
  });
});

describe('buildEigenKosCapabilityDenialBody', () => {
  it('emits the stable 403 payload shape clients and operator tooling key on', () => {
    const body = buildEigenKosCapabilityDenialBody({
      surface: 'eigen-chat',
      message: 'KOS capability bundle denied for eigen-chat: ai:synthesis',
      deniedCapabilityTags: ['ai:synthesis'],
      deniedReasonsByCapability: {
        'ai:synthesis': ['No matching allow rule'],
      },
    });
    expect(body).toEqual({
      error: 'KOS capability bundle denied for eigen-chat: ai:synthesis',
      surface: 'eigen-chat',
      denied_capabilities: ['ai:synthesis'],
      denied_reasons_by_capability: {
        'ai:synthesis': ['No matching allow rule'],
      },
    });
  });
});
