import { describe, expect, it } from 'vitest';
import { mapSmartplrxTrendToEigen } from '../../src/adapters/smartplrx-trend-tracker/eigen-smartplrx-adapter.js';

describe('Smartplrx Eigen adapter', () => {
  it('defaults to public corpus with smartplrx tags', () => {
    const payload = mapSmartplrxTrendToEigen({
      trend_id: 'trend-1',
      title: 'Creatine steady state',
      body: 'Body',
      tags: ['supplement-trend'],
    });

    expect(payload.source_system).toBe('smartplrx');
    expect(payload.source_ref).toBe('trend-1');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('smartplrx');
  });

  it('uses eigenx when visibility is internal', () => {
    const payload = mapSmartplrxTrendToEigen({
      trend_id: 'trend-2',
      title: 'Operator notes',
      body: 'Private',
      visibility: 'eigenx',
    });

    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).not.toContain('eigen_public');
  });
});
