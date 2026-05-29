import { describe, expect, it } from 'vitest';
import {
  formatGovernanceContextForLlm,
  formatOracleRunContextForLlm,
  isValidGovernanceId,
} from '../../src/lib/eigen/chat-governance-context.ts';

const SAMPLE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('chat-governance-context', () => {
  it('validates governance ids as uuids', () => {
    expect(isValidGovernanceId(SAMPLE_ID)).toBe(true);
    expect(isValidGovernanceId('not-a-uuid')).toBe(false);
  });

  it('formats oracle run context for the llm', () => {
    const block = formatOracleRunContextForLlm({
      id: SAMPLE_ID,
      domain: 'biotech',
      status: 'completed',
      runLabel: 'Q2 whitespace scan',
      riskLevel: 'medium',
    });
    expect(block).toContain('Oracle whitespace run');
    expect(block).toContain('biotech');
    expect(block).toContain('Q2 whitespace scan');
  });

  it('combines oracle and charter blocks', () => {
    const block = formatGovernanceContextForLlm({
      oracleRun: {
        id: SAMPLE_ID,
        domain: 'real_estate',
        status: 'running',
      },
      charterDecision: {
        id: SAMPLE_ID,
        title: 'Approve payout',
        decisionType: 'approval',
        status: 'final',
        linkedTable: 'payouts',
        rationale: 'Meets policy threshold.',
      },
    });
    expect(block).toContain('Oracle whitespace run');
    expect(block).toContain('Charter decision');
    expect(block).toContain('Approve payout');
  });
});
