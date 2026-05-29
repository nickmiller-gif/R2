import { describe, expect, it } from 'vitest';
import { computeRrfScores, sortIdsByRrfScore } from '../../src/lib/eigen/reciprocal-rank-fusion.ts';

describe('reciprocal-rank-fusion', () => {
  it('boosts chunks that rank highly in multiple lists', () => {
    const scores = computeRrfScores([
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [{ id: 'b' }, { id: 'a' }, { id: 'd' }],
    ]);
    expect(scores.get('b')!).toBeGreaterThan(scores.get('c')!);
    expect(scores.get('a')!).toBeGreaterThan(scores.get('d')!);
  });

  it('sorts ids by descending rrf score', () => {
    const scores = computeRrfScores([
      [{ id: 'x' }, { id: 'y' }],
      [{ id: 'y' }, { id: 'z' }],
    ]);
    expect(sortIdsByRrfScore(scores)[0]).toBe('y');
  });

  it('ignores empty ids', () => {
    const scores = computeRrfScores([[{ id: '' }, { id: 'ok' }]]);
    expect(scores.has('')).toBe(false);
    expect(scores.get('ok')).toBeGreaterThan(0);
  });
});
