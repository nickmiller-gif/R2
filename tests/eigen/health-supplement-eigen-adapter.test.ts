import { describe, expect, it } from 'vitest';
import { mapHealthSupplementTrendToEigen } from '../../src/adapters/health-supplement-tr/eigen-health-supplement-adapter.js';

describe('Health Supplement Eigen adapter', () => {
  it('defaults visibility to public and includes eigen_public tag', () => {
    const payload = mapHealthSupplementTrendToEigen({
      trend_id: 'trend-1',
      title: 'Ashwagandha momentum',
      body: 'Trend body',
      tags: ['trend-intelligence'],
    });

    expect(payload.source_system).toBe('health-supplement-tr');
    expect(payload.source_ref).toBe('trend-1');
    expect(payload.document.metadata?.visibility).toBe('public');
    expect(payload.policy_tags).toContain('eigen_public');
    expect(payload.policy_tags).toContain('trend-intelligence');
  });

  it('uses eigenx tag when visibility is explicitly internal', () => {
    const payload = mapHealthSupplementTrendToEigen({
      trend_id: 'trend-2',
      title: 'Internal model notes',
      body: 'Operator-only note',
      visibility: 'eigenx',
      tags: ['operator-notes'],
    });

    expect(payload.document.metadata?.visibility).toBe('eigenx');
    expect(payload.policy_tags).toContain('eigenx');
    expect(payload.policy_tags).not.toContain('eigen_public');
    expect(payload.policy_tags).toContain('operator-notes');
  });
});
