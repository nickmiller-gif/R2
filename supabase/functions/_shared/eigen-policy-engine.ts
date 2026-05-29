import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Use the pure roles module so the engine remains typecheckable by Node tsc
// when pulled into tests — rbac.ts transitively imports Deno globals.
import type { CharterRole } from './roles.ts';
import { evaluateEigenPolicyRulesPerCapability } from '../../../src/lib/eigen/eigen-policy-eval.ts';
import type { EigenPolicyRule } from '../../../src/types/eigen/policy-engine.ts';

interface DbEigenPolicyRuleRow {
  id: string;
  policy_tag: string;
  capability_tag_pattern: string;
  effect: 'allow' | 'deny';
  required_role: string | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface LoadedPolicyRules {
  rules: EigenPolicyRule[];
  rulesExist: boolean;
}

export interface ResolveEigenCapabilityAccessInput {
  policyTags: string[];
  capabilityTags: string[];
  callerRoles: CharterRole[];
}

export interface ResolveEigenCapabilityAccessResult {
  allowedCapabilityTags: string[];
  deniedCapabilityTags: string[];
  rulesConfigured: boolean;
  deniedReasonsByCapability: Record<string, string[]>;
}

function normalizeTags(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function rowToRule(row: DbEigenPolicyRuleRow): EigenPolicyRule {
  return {
    id: row.id,
    policyTag: row.policy_tag,
    capabilityTagPattern: row.capability_tag_pattern,
    effect: row.effect,
    requiredRole: row.required_role,
    rationale: row.rationale,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function hasAnyPolicyRules(client: SupabaseClient): Promise<boolean> {
  const query = await client.from('eigen_policy_rules').select('id');
  if (query.error) throw new Error(query.error.message);
  return (query.data ?? []).length > 0;
}

async function loadPolicyRules(client: SupabaseClient): Promise<LoadedPolicyRules> {
  // Hot-path enforcement must only see currently-active rules. The supersede
  // flow (migration 202604240006) keeps superseded rows in the table for
  // audit/history with `is_active=false`; including them here would let a
  // superseded allow/deny continue to gate retrieve/chat/widget surfaces
  // after operators rolled it forward.
  const query = await client
    .from('eigen_policy_rules')
    .select(
      'id,policy_tag,capability_tag_pattern,effect,required_role,rationale,metadata,created_at,updated_at,is_active',
    )
    .eq('is_active', true);
  if (query.error) throw new Error(query.error.message);
  const rows = (query.data ?? []) as DbEigenPolicyRuleRow[];
  if (rows.length > 0) {
    return { rules: rows.map(rowToRule), rulesExist: true };
  }
  return { rules: [], rulesExist: await hasAnyPolicyRules(client) };
}

export async function resolveEigenCapabilityAccess(
  client: SupabaseClient,
  input: ResolveEigenCapabilityAccessInput,
): Promise<ResolveEigenCapabilityAccessResult> {
  const policyTags = normalizeTags(input.policyTags);
  const capabilityTags = normalizeTags(input.capabilityTags);
  if (capabilityTags.length === 0) {
    return {
      allowedCapabilityTags: [],
      deniedCapabilityTags: [],
      rulesConfigured: false,
      deniedReasonsByCapability: {},
    };
  }

  const { rules, rulesExist } = await loadPolicyRules(client);
  if (!rulesExist) {
    return {
      allowedCapabilityTags: capabilityTags,
      deniedCapabilityTags: [],
      rulesConfigured: false,
      deniedReasonsByCapability: {},
    };
  }

  const { allowedCapabilityTags, deniedCapabilityTags, deniedReasonsByCapability } =
    evaluateEigenPolicyRulesPerCapability(rules, policyTags, capabilityTags, input.callerRoles);

  return {
    allowedCapabilityTags,
    deniedCapabilityTags,
    rulesConfigured: true,
    deniedReasonsByCapability,
  };
}
