import { describe, expect, it } from 'vitest';
import { scoreStewardBriefJson } from '../../packages/r2-eval/src/scorers/steward-brief.ts';

const VALID = JSON.stringify({
  pattern_id: 'steward-pattern:0:abc',
  domains: ['centralr2', 'operator_workbench', 'r2chart'],
  meg_entity_ids: ['meg-1', 'meg-2'],
  narrative: 'Cross-domain pattern across three KB drivers.',
  completeness_score: 0.72,
  findings: [
    {
      finding_id: 'steward:0:meg:actor',
      check_type: 'unresolved_meg',
      suggested_fill_action: 'Run MEG backfill.',
    },
  ],
  recommended_actions: ['open_convergence', 'promote_to_truth_market'],
  evidence_sample: [{ feed_item_id: 'x', summary: 's', source_system: 'centralr2' }],
});

describe('steward brief scorer', () => {
  it('accepts well-formed steward brief JSON', () => {
    const result = scoreStewardBriefJson(VALID);
    expect(result.pass).toBe(true);
  });

  it('rejects fewer than 3 domains', () => {
    const result = scoreStewardBriefJson(
      JSON.stringify({
        pattern_id: 'p',
        domains: ['centralr2'],
        meg_entity_ids: ['meg-1'],
        narrative: 'x',
        completeness_score: 0.5,
        findings: [],
        recommended_actions: ['open_convergence'],
      }),
    );
    expect(result.pass).toBe(false);
  });
});
