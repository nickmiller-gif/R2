import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  evaluateEigenPolicyRules,
  type DbEigenPolicyRuleRow,
} from '../../../src/services/eigen/policy-engine.service.ts';
import type { EigenPolicyRule } from '../../../src/types/eigen/policy-engine.ts';
import type { CharterRole } from './rbac.ts';

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

async function loadPolicyRules(client: SupabaseClient): Promise<EigenPolicyRule[]> {
  const query = await client
    .from('eigen_policy_rules')
    .select(
      'id,policy_tag,capability_tag_pattern,effect,required_role,rationale,metadata,created_at,updated_at',
    );
  if (query.error) throw new Error(query.error.message);
  const rows = (query.data ?? []) as DbEigenPolicyRuleRow[];
  return rows.map(rowToRule);
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

  const rules = await loadPolicyRules(client);
  if (rules.length === 0) {
    return {
      allowedCapabilityTags: capabilityTags,
      deniedCapabilityTags: [],
      rulesConfigured: false,
      deniedReasonsByCapability: {},
    };
  }

  const allowedCapabilityTags: string[] = [];
  const deniedCapabilityTags: string[] = [];
  const deniedReasonsByCapability: Record<string, string[]> = {};

  for (const capabilityTag of capabilityTags) {
    const evaluation = evaluateEigenPolicyRules(rules, {
      policyTags,
      capabilityTags: [capabilityTag],
      callerRoles: input.callerRoles,
    });
    if (evaluation.allowed) {
      allowedCapabilityTags.push(capabilityTag);
    } else {
      deniedCapabilityTags.push(capabilityTag);
      deniedReasonsByCapability[capabilityTag] = evaluation.denyReasons;
    }
  }

  return {
    allowedCapabilityTags,
    deniedCapabilityTags,
    rulesConfigured: true,
    deniedReasonsByCapability,
  };
}
