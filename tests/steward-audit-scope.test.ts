import { describe, expect, it } from 'vitest';
import {
  buildCorpusFindingsForStewardDrivers,
  filterInformationFindingsForStewardCluster,
} from '../packages/r2-steward/src/audit-scope.ts';

describe('steward audit scoping', () => {
  it('filters portfolio findings to cluster drivers and feed ids', () => {
    const findings = [
      {
        finding_id: 'traffic:centralr2:missing',
        check_type: 'missing_live_traffic' as const,
        severity: 'high' as const,
        target_kb_driver: 'centralr2' as const,
        resource_type: 'platform_feed_items',
        field_path: 'source_event_type',
        status: 'missing' as const,
        observed: '0',
        expected: 'live',
        suggested_fill_action: 'publish',
        auto_fillable: false,
      },
      {
        finding_id: 'traffic:ip_pulse_point:missing',
        check_type: 'missing_live_traffic' as const,
        severity: 'high' as const,
        target_kb_driver: 'ip_pulse_point' as const,
        resource_type: 'platform_feed_items',
        field_path: 'source_event_type',
        status: 'missing' as const,
        observed: '0',
        expected: 'live',
        suggested_fill_action: 'analyze',
        auto_fillable: false,
      },
    ];
    const scoped = filterInformationFindingsForStewardCluster(findings, {
      drivers: new Set(['centralr2', 'r2chart', 'operator_workbench']),
      feedItemIds: new Set(['feed-1']),
      megEntityIds: new Set(['meg-a']),
    });
    expect(scoped).toHaveLength(1);
    expect(scoped[0]!.target_kb_driver).toBe('centralr2');
  });

  it('builds corpus findings for cluster drivers only', () => {
    const inventory = {
      generated_at: new Date().toISOString(),
      mode: 'all',
      total_documents: 0,
      total_chunks: 0,
      sources: [],
      documents: [],
    };
    const findings = buildCorpusFindingsForStewardDrivers(
      inventory,
      new Set(['centralr2', 'r2chart', 'ip_pulse_point']),
      0,
    );
    expect(findings.length).toBe(3);
    expect(findings.every((f) => f.check_type === 'missing_corpus')).toBe(true);
  });
});
