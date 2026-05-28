import { describe, expect, it } from 'vitest';
import { scoreRevolutionaryMeshJson } from '../../packages/r2-eval/src/scorers/revolutionary-mesh.ts';

const VALID = JSON.stringify({
  patterns: [
    {
      title: 'GLP-1 crosses real estate and health',
      domains: ['centralr2', 'formahealth'],
      narrative: 'Multiple brands surfaced GLP-1 adjacent signals in 72h.',
      recommended_bot_mesh_action: 'Queue cross-domain pattern review on /revolutionary-bots.',
      confidence: 0.78,
    },
    {
      title: 'Patent + charter governance convergence',
      domains: ['ip_pulse_point', 'r2chart'],
      narrative: 'IP and continuity signals mention the same policy gap.',
      recommended_bot_mesh_action: 'Draft Truth Market brief from correlated feed rows.',
      confidence: 0.74,
    },
  ],
});

describe('revolutionary mesh scorer', () => {
  it('accepts well-formed pattern JSON', () => {
    const result = scoreRevolutionaryMeshJson(VALID);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('rejects single-domain patterns', () => {
    const result = scoreRevolutionaryMeshJson(
      JSON.stringify({
        patterns: [
          {
            title: 'Only one domain',
            domains: ['centralr2'],
            narrative: 'x',
            recommended_bot_mesh_action: 'y',
            confidence: 0.5,
          },
        ],
      }),
    );
    expect(result.pass).toBe(false);
  });
});
