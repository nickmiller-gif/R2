/**
 * Eigen chat — format Oracle / Charter governance context for LLM prompts (Deno-free).
 */

import { isValidMegEntityId, sanitizePromptFieldText } from './chat-entity-context.ts';

export const EIGEN_GOVERNANCE_CONTEXT_INTRO =
  'Linked governance context (Oracle whitespace run and/or Charter decision; prefer over generic corpus when relevant):';

const MAX_GOVERNANCE_FIELD_CHARS = 400;

export interface OracleRunContextForPrompt {
  id: string;
  domain: string;
  status: string;
  runLabel?: string;
  riskLevel?: string;
  timeHorizon?: string;
  errorMessage?: string;
}

export interface CharterDecisionContextForPrompt {
  id: string;
  title: string;
  decisionType: string;
  status: string;
  linkedTable: string;
  rationale?: string;
}

export function isValidGovernanceId(value: string): boolean {
  return isValidMegEntityId(value);
}

export function formatOracleRunContextForLlm(run: OracleRunContextForPrompt): string {
  const lines = [
    `Oracle whitespace run: ${run.id}`,
    `Domain: ${run.domain}`,
    `Status: ${run.status}`,
  ];
  if (run.runLabel) lines.push(`Label: ${sanitizePromptFieldText(run.runLabel, 120)}`);
  if (run.riskLevel) lines.push(`Risk: ${run.riskLevel}`);
  if (run.timeHorizon) lines.push(`Horizon: ${sanitizePromptFieldText(run.timeHorizon, 80)}`);
  if (run.errorMessage) {
    lines.push(`Note: ${sanitizePromptFieldText(run.errorMessage, MAX_GOVERNANCE_FIELD_CHARS)}`);
  }
  return lines.join('\n');
}

export function formatCharterDecisionContextForLlm(
  decision: CharterDecisionContextForPrompt,
): string {
  const lines = [
    `Charter decision: ${decision.id}`,
    `Title: ${sanitizePromptFieldText(decision.title, 200)}`,
    `Type: ${decision.decisionType}`,
    `Status: ${decision.status}`,
    `Linked: ${decision.linkedTable}`,
  ];
  if (decision.rationale) {
    lines.push(
      `Rationale: ${sanitizePromptFieldText(decision.rationale, MAX_GOVERNANCE_FIELD_CHARS)}`,
    );
  }
  return lines.join('\n');
}

export function formatGovernanceContextForLlm(input: {
  oracleRun?: OracleRunContextForPrompt | null;
  charterDecision?: CharterDecisionContextForPrompt | null;
}): string {
  const blocks: string[] = [];
  if (input.oracleRun) blocks.push(formatOracleRunContextForLlm(input.oracleRun));
  if (input.charterDecision) {
    blocks.push(formatCharterDecisionContextForLlm(input.charterDecision));
  }
  return blocks.join('\n\n---\n\n');
}
