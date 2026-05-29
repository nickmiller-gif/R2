/**
 * Static contract tests for the atomic supersede flow shared by the
 * `eigen_policy_rule_supersede` Postgres RPC (migration 20260529170000)
 * and the `eigen-policy-rules` edge function PATCH handler.
 *
 * Why static? The previous implementation did the supersede as two
 * separate writes (INSERT successor, then UPDATE predecessor). Whenever
 * the PATCH preserved the (policy_tag, capability_tag_pattern, effect,
 * required_role) tuple the insert collided with the partial unique index
 * `idx_eigen_policy_rules_one_active_*` and 400'd with an opaque
 * constraint error. The fix moves the swap into a single transaction
 * inside an RPC, and pins:
 *
 *   1. the RPC retires the predecessor BEFORE inserting the successor
 *      (so the unique-index slot frees in time);
 *   2. the edge function calls the RPC with the documented parameter
 *      names (drift here would silently fall back to a 500);
 *   3. the legacy ordering — INSERT then UPDATE from the edge function —
 *      does not return.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const MIGRATION = readFileSync(
  join(REPO_ROOT, 'supabase/migrations/20260529170000_eigen_policy_rule_supersede_rpc.sql'),
  'utf8',
);
const EDGE_FN = readFileSync(
  join(REPO_ROOT, 'supabase/functions/eigen-policy-rules/index.ts'),
  'utf8',
);

describe('eigen_policy_rule_supersede RPC contract', () => {
  it('declares the function with the parameter list the edge function passes', () => {
    expect(MIGRATION).toMatch(/CREATE OR REPLACE FUNCTION public\.eigen_policy_rule_supersede\(/);
    for (const param of [
      'p_predecessor_id uuid',
      'p_policy_tag text',
      'p_capability_tag_pattern text',
      'p_effect text',
      'p_required_role charter_role',
      'p_rationale text',
      'p_metadata jsonb',
    ]) {
      expect(MIGRATION).toContain(param);
    }
  });

  it('returns the predecessor and successor as jsonb so audit logs can snapshot both rows', () => {
    expect(MIGRATION).toMatch(/RETURNS jsonb/);
    expect(MIGRATION).toMatch(/'predecessor',\s*to_jsonb\(v_predecessor\)/);
    expect(MIGRATION).toMatch(/'successor',\s*to_jsonb\(v_successor\)/);
  });

  it('retires the predecessor BEFORE inserting the successor (frees the partial unique index slot)', () => {
    const updateIdx = MIGRATION.indexOf('UPDATE public.eigen_policy_rules');
    const insertIdx = MIGRATION.indexOf('INSERT INTO public.eigen_policy_rules');
    expect(updateIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeLessThan(insertIdx);
  });

  it('locks the predecessor row FOR UPDATE so concurrent supersedes serialise', () => {
    expect(MIGRATION).toMatch(
      /FROM public\.eigen_policy_rules\s+WHERE id = p_predecessor_id\s+FOR UPDATE/,
    );
  });

  it('raises named SQLSTATEs the edge function maps to 404 / 409 / 400', () => {
    expect(MIGRATION).toMatch(/predecessor_not_found.*ERRCODE = 'P0001'/s);
    expect(MIGRATION).toMatch(/predecessor_already_inactive.*ERRCODE = 'P0002'/s);
    expect(MIGRATION).toMatch(/invalid_effect.*ERRCODE = 'P0003'/s);
  });

  it('is callable only by service_role', () => {
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.eigen_policy_rule_supersede[\s\S]*?FROM PUBLIC/,
    );
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.eigen_policy_rule_supersede[\s\S]*?FROM authenticated/,
    );
    expect(MIGRATION).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.eigen_policy_rule_supersede[\s\S]*?TO service_role/,
    );
  });
});

describe('eigen-policy-rules PATCH handler contract', () => {
  it('calls the supersede RPC with the documented parameter names', () => {
    expect(EDGE_FN).toContain("serviceClient.rpc(\n          'eigen_policy_rule_supersede'");
    for (const param of [
      'p_predecessor_id:',
      'p_policy_tag:',
      'p_capability_tag_pattern:',
      'p_effect:',
      'p_required_role:',
      'p_rationale:',
      'p_metadata:',
    ]) {
      expect(EDGE_FN).toContain(param);
    }
  });

  it('does not retain the legacy two-step INSERT-then-UPDATE supersede path', () => {
    // The pre-fix flow built `next` with version / is_active fields baked in
    // and inserted the successor before flipping the predecessor. The RPC
    // owns version / is_active now; the edge function must not smuggle them.
    expect(EDGE_FN).not.toMatch(/version:\s*\(predecessor\.version/);
    expect(EDGE_FN).not.toMatch(/\.insert\(\[next\]\)/);
  });

  it('maps the RPC SQLSTATE messages to stable HTTP codes', () => {
    expect(EDGE_FN).toContain("message.includes('predecessor_not_found')");
    expect(EDGE_FN).toContain("message.includes('predecessor_already_inactive')");
    expect(EDGE_FN).toContain("message.includes('invalid_effect')");
  });

  it('writes both supersede + create audit entries off the RPC response', () => {
    expect(EDGE_FN).toContain("action: 'supersede'");
    expect(EDGE_FN).toContain("action: 'create'");
    expect(EDGE_FN).toContain('successor_rule_id: newId');
    expect(EDGE_FN).toContain('predecessor_rule_id: ruleId');
  });
});
