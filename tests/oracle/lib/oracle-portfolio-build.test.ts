import { describe, expect, it } from 'vitest';
import { scoreWhitespace, buildOpportunityPortfolio, persistOpportunities, type ThesisSnapshot } from '../../../src/lib/oracle/portfolio-build.js';

describe('scoreWhitespace', () => {
  it('downgrades economics confidence when contradictions are high', () => {
    const scored = [ ...scoreWhitespace([
      {
        thesisId: 't1',
        profileId: 'p1',
        title: 'Test',
        buyer: 'Buyer',
        offer: 'Offer',
        channel: 'direct',
        whitespaceScore: 20,
        evidenceSupportScore: 70,
        contradictionRatio: 0.6,
      },
    ]) ];

    expect(scored[0].confidenceEconomics).toBeLessThan(50);
    expect(scored[0].downgradeReason).toBe('contradiction_downgrade');
  });

  it('gates economics confidence when evidence support is weak', () => {
    const scored = [ ...scoreWhitespace([
      {
        thesisId: 't2',
        profileId: 'p1',
        title: 'Test2',
        buyer: 'Buyer',
        offer: 'Offer',
        channel: 'partner',
        whitespaceScore: 50,
        evidenceSupportScore: 30,
        contradictionRatio: 0.1,
      },
    ]) ];

    expect(scored[0].confidenceEconomics).toBeLessThanOrEqual(30);
    expect(scored[0].downgradeReason).toBe('evidence_gate');
  });
});

describe('portfolio_build persistence', () => {
  it('upserts opportunities with stable conflict key', async () => {
    const thesis: ThesisSnapshot = {
      id: 'thesis-1',
      profile_id: 'profile-1',
      title: 'Opportunity A',
      thesis_statement: 'Buyers need automation.',
      confidence: 82,
      evidence_strength: 68,
      validation_evidence_item_ids: ['e1'],
      contradiction_evidence_item_ids: [],
      metadata: { buyer: 'Ops', offer: 'Automation' },
    };

    const built = buildOpportunityPortfolio(
      [
        {
          thesisId: 'thesis-1',
          profileId: 'profile-1',
          title: 'Opportunity A',
          buyer: 'Ops',
          offer: 'Automation',
          channel: 'direct',
          whitespaceScore: 20,
          evidenceSupportScore: 72,
          contradictionRatio: 0,
          confidenceEconomics: 76,
          confidenceTiming: 74,
          downgradeReason: null,
        },
      ],
      new Map([[thesis.id, thesis]]),
    );

    const calls: { table?: string; onConflict?: string; payload?: unknown } = {};
    const mockClient = {
      from(table: string) {
        calls.table = table;
        return {
          upsert(payload: unknown, options: { onConflict: string }) {
            calls.onConflict = options.onConflict;
            calls.payload = payload;
            return {
              async select() {
                return { data: payload as never, error: null };
              },
            };
          },
        };
      },
    };

    const persisted = await persistOpportunities(mockClient, built);

    expect(persisted).toHaveLength(1);
    expect(calls.table).toBe('oracle_opportunities');
    expect(calls.onConflict).toBe('profile_id,thesis_id,title');
    expect(Array.isArray(calls.payload)).toBe(true);
  });
});
