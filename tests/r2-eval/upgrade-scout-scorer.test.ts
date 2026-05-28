import { describe, expect, it } from 'vitest';
import { scoreUpgradeScoutJson } from '../../packages/r2-eval/src/scorers/upgrade-scout.ts';

const VALID = JSON.stringify({
  upgrades: [
    {
      headline: 'Refresh rental-analysis comps',
      why_now: 'Market rent volatility increased.',
      proposed_bot_action: 'Trigger rental-analysis on top properties.',
      confidence: 0.82,
      impacted_stream: 'Stream A',
    },
    {
      headline: 'Harden AI Health Check',
      why_now: 'Secret rotation cadence tightened.',
      proposed_bot_action: 'Run probe after Lovable publish.',
      confidence: 0.77,
      impacted_stream: 'Stream A',
    },
    {
      headline: 'MEG property resolve',
      why_now: 'Sparse meg_entities on mesh rows.',
      proposed_bot_action: 'Run meg-backfill smoke.',
      confidence: 0.71,
      impacted_stream: 'Stream A',
    },
  ],
});

describe('upgrade scout scorer', () => {
  it('accepts well-formed upgrade JSON', () => {
    const result = scoreUpgradeScoutJson(VALID);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('rejects too few upgrades', () => {
    const result = scoreUpgradeScoutJson(
      JSON.stringify({
        upgrades: [
          {
            headline: 'Only one',
            why_now: 'x',
            proposed_bot_action: 'y',
            confidence: 0.5,
            impacted_stream: 'Stream A',
          },
        ],
      }),
    );
    expect(result.pass).toBe(false);
  });

  it('rejects invalid confidence', () => {
    const result = scoreUpgradeScoutJson(
      JSON.stringify({
        upgrades: [
          {
            headline: 'a',
            why_now: 'b',
            proposed_bot_action: 'c',
            confidence: 2,
            impacted_stream: 'Stream A',
          },
          {
            headline: 'd',
            why_now: 'e',
            proposed_bot_action: 'f',
            confidence: 0.5,
            impacted_stream: 'Stream A',
          },
          {
            headline: 'g',
            why_now: 'h',
            proposed_bot_action: 'i',
            confidence: 0.5,
            impacted_stream: 'Stream A',
          },
        ],
      }),
    );
    expect(result.pass).toBe(false);
  });
});
