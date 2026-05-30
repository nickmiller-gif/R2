/**
 * Contract tests for the `supersede_eigen_policy_rule` RPC glue used by
 * the PATCH /eigen-policy-rules edge function.
 *
 * The shim itself is small (build patch jsonb, call rpc, map sqlstate
 * to HTTP) but the shape it sends to Postgres is the contract: changing
 * any argument name or layout silently breaks every operator PATCH. We
 * pin the wire shape here so a rename fires a unit test before it 500s
 * in production.
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildSupersedePatchPayload,
  callSupersedePolicyRuleRpc,
} from '../../supabase/functions/_shared/eigen-policy-rule-supersede.ts';

function makeRpcClient(rpcResult: {
  data: unknown;
  error: { message: string; code?: string } | null;
}) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const fake = {
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return Promise.resolve(rpcResult);
    },
  };
  return { client: fake as unknown as SupabaseClient, calls };
}

describe('buildSupersedePatchPayload', () => {
  it('includes only keys the caller explicitly set', () => {
    expect(buildSupersedePatchPayload({ rationale: 'new reason' })).toEqual({
      rationale: 'new reason',
    });
  });

  it('preserves explicit null so the RPC can clear required_role', () => {
    expect(buildSupersedePatchPayload({ required_role: null })).toEqual({
      required_role: null,
    });
  });

  it('preserves empty string distinct from absence', () => {
    expect(buildSupersedePatchPayload({ rationale: '' })).toEqual({ rationale: '' });
  });

  it('returns an empty patch when no allowlisted keys are present', () => {
    expect(buildSupersedePatchPayload({})).toEqual({});
    // Unknown keys are ignored — operators cannot smuggle version /
    // is_active / superseded_by through this surface.
    expect(
      buildSupersedePatchPayload({ version: 99, is_active: false } as Record<string, unknown>),
    ).toEqual({});
  });

  it('passes through all six allowlisted keys when present', () => {
    expect(
      buildSupersedePatchPayload({
        policy_tag: 'eigen_public',
        capability_tag_pattern: 'read:*',
        effect: 'allow',
        required_role: 'operator',
        rationale: 'incident:2026-05-30',
        metadata: { ticket: 'OPS-42' },
      }),
    ).toEqual({
      policy_tag: 'eigen_public',
      capability_tag_pattern: 'read:*',
      effect: 'allow',
      required_role: 'operator',
      rationale: 'incident:2026-05-30',
      metadata: { ticket: 'OPS-42' },
    });
  });
});

describe('callSupersedePolicyRuleRpc', () => {
  it('sends the migration-shaped argument bundle to supersede_eigen_policy_rule', async () => {
    const { client, calls } = makeRpcClient({
      data: { id: 'new-rule-id', version: 2, is_active: true },
      error: null,
    });
    const result = await callSupersedePolicyRuleRpc(client, {
      ruleId: 'pred-id',
      patch: { rationale: 'tighten write:* to operator-only during incident' },
      actorId: 'actor-99',
      correlationId: 'cid-1',
      rationale: 'tighten write:* to operator-only during incident',
      historyMetadata: { surface: 'eigen-policy-rules', http_method: 'PATCH' },
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(result.data).toEqual({ id: 'new-rule-id', version: 2, is_active: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('supersede_eigen_policy_rule');
    expect(calls[0].args).toEqual({
      p_rule_id: 'pred-id',
      p_patch: { rationale: 'tighten write:* to operator-only during incident' },
      p_actor_id: 'actor-99',
      p_correlation_id: 'cid-1',
      p_rationale: 'tighten write:* to operator-only during incident',
      p_history_metadata: { surface: 'eigen-policy-rules', http_method: 'PATCH' },
    });
  });

  it('maps Postgres P0002 (rule not found) to HTTP 404', async () => {
    const { client } = makeRpcClient({
      data: null,
      error: { message: 'Rule not found: 00000000-0000-0000-0000-000000000999', code: 'P0002' },
    });
    const result = await callSupersedePolicyRuleRpc(client, {
      ruleId: '00000000-0000-0000-0000-000000000999',
      patch: {},
      actorId: null,
      correlationId: null,
      rationale: null,
      historyMetadata: {},
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toContain('Rule not found');
  });

  it('maps Postgres P0001 (already inactive) to HTTP 409', async () => {
    const { client } = makeRpcClient({
      data: null,
      error: {
        message: 'Cannot supersede an already-inactive rule (r1); start from its active successor',
        code: 'P0001',
      },
    });
    const result = await callSupersedePolicyRuleRpc(client, {
      ruleId: 'r1',
      patch: {},
      actorId: null,
      correlationId: null,
      rationale: null,
      historyMetadata: {},
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain('already-inactive');
  });

  it('falls through to HTTP 500 for unknown / missing SQLSTATE', async () => {
    const { client } = makeRpcClient({
      data: null,
      error: { message: 'connection reset by peer' },
    });
    const result = await callSupersedePolicyRuleRpc(client, {
      ruleId: 'r1',
      patch: {},
      actorId: null,
      correlationId: null,
      rationale: null,
      historyMetadata: {},
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe('connection reset by peer');
  });
});
