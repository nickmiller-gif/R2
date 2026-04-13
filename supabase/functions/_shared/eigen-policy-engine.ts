import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CharterRole } from './rbac.ts';

interface EigenPolicyRule {
  id: string;
  policyTag: string;
  capabilityTagPattern: string;
  effect: 'allow' | 'deny';
  requiredRole: string | null;
  rationale: string | null;
}

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

const ROLE_HIERARCHY = ['member', 'reviewer', 'operator', 'counsel', 'admin'] as const;
type HierarchicalRole = (typeof ROLE_HIERARCHY)[number];

function isHierarchicalRole(value: string): value is HierarchicalRole {
  return ROLE_HIERARCHY.includes(value as HierarchicalRole);
}

function hasRequiredRole(callerRoles: string[], requiredRole: string | null): boolean {
  if (!requiredRole) return true;
  if (callerRoles.includes(requiredRole)) return true;
  if (!isHierarchicalRole(requiredRole)) return false;
  const minimumIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return callerRoles.some((role) => isHierarchicalRole(role) && ROLE_HIERARCHY.indexOf(role) >= minimumIndex);
}

function matchWildcard(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function matchesRule(
  rule: EigenPolicyRule,
  input: { policyTags: string[]; capabilityTags: string[]; callerRoles: string[] },
): boolean {
  const policyTagMatch = input.policyTags.some((tag) => matchWildcard(rule.policyTag, tag));
  if (!policyTagMatch) return false;
  const capabilityTagMatch = input.capabilityTags.some((tag) => matchWildcard(rule.capabilityTagPattern, tag));
  if (!capabilityTagMatch) return false;
  return hasRequiredRole(input.callerRoles, rule.requiredRole);
}

function evaluateEigenPolicyRules(
  rules: EigenPolicyRule[],
  input: { policyTags: string[]; capabilityTags: string[]; callerRoles: string[] },
): { allowed: boolean; denyReasons: string[] } {
  const matching = rules.filter((rule) => matchesRule(rule, input));
  const denying = matching.filter((rule) => rule.effect === 'deny');
  if (denying.length > 0) {
    return { allowed: false, denyReasons: denying.map((r) => r.rationale ?? `Denied by ${r.id}`) };
  }
  const allowing = matching.filter((rule) => rule.effect === 'allow');
  return { allowed: allowing.length > 0, denyReasons: allowing.length > 0 ? [] : ['No matching allow rule'] };
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
