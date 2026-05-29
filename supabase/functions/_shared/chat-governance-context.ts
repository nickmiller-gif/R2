import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type CharterDecisionContextForPrompt,
  type OracleRunContextForPrompt,
  isValidGovernanceId,
} from '../../../src/lib/eigen/chat-governance-context.ts';

export interface FetchGovernanceContextInput {
  oracleRunId?: string;
  charterDecisionId?: string;
}

export interface FetchGovernanceContextResult {
  oracleRun: OracleRunContextForPrompt | null;
  charterDecision: CharterDecisionContextForPrompt | null;
}

export async function fetchGovernanceContextForChat(
  client: SupabaseClient,
  input: FetchGovernanceContextInput,
): Promise<FetchGovernanceContextResult> {
  const [oracleRun, charterDecision] = await Promise.all([
    input.oracleRunId && isValidGovernanceId(input.oracleRunId)
      ? loadOracleRunContext(client, input.oracleRunId)
      : Promise.resolve(null),
    input.charterDecisionId && isValidGovernanceId(input.charterDecisionId)
      ? loadCharterDecisionContext(client, input.charterDecisionId)
      : Promise.resolve(null),
  ]);
  return { oracleRun, charterDecision };
}

async function loadOracleRunContext(
  client: SupabaseClient,
  runId: string,
): Promise<OracleRunContextForPrompt | null> {
  const { data, error } = await client
    .from('oracle_whitespace_runs')
    .select('id, domain, status, run_label, risk_level, time_horizon, error_message')
    .eq('id', runId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    domain: String(data.domain ?? ''),
    status: String(data.status ?? ''),
    runLabel: typeof data.run_label === 'string' ? data.run_label : undefined,
    riskLevel: typeof data.risk_level === 'string' ? data.risk_level : undefined,
    timeHorizon: typeof data.time_horizon === 'string' ? data.time_horizon : undefined,
    errorMessage: typeof data.error_message === 'string' ? data.error_message : undefined,
  };
}

async function loadCharterDecisionContext(
  client: SupabaseClient,
  decisionId: string,
): Promise<CharterDecisionContextForPrompt | null> {
  const { data, error } = await client
    .from('charter_decisions')
    .select('id, title, decision_type, status, linked_table, rationale')
    .eq('id', decisionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    title: String(data.title ?? ''),
    decisionType: String(data.decision_type ?? ''),
    status: String(data.status ?? ''),
    linkedTable: String(data.linked_table ?? ''),
    rationale: typeof data.rationale === 'string' ? data.rationale : undefined,
  };
}
