import { describe, expect, it } from 'vitest';
import {
  buildClustersFromRows,
  countsTowardKbDriver,
  extractMegIdsFromRow,
  filterEdgesWithinMegHops,
  megIdsWithinHops,
  UnionFind,
} from '../packages/r2-steward/src/cluster.ts';

describe('steward clustering', () => {
  it('maps source systems to KB drivers', () => {
    expect(countsTowardKbDriver('centralr2', 'rental_analysis')).toBe('centralr2');
    expect(countsTowardKbDriver('r2_works', 'friction_zero')).toBe('operator_workbench');
    expect(countsTowardKbDriver('autonomous_bot_os', 'bot_finding_published')).toBeNull();
  });

  it('union-find merges MEG ids', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('b', 'c');
    expect(uf.find('c')).toBe(uf.find('a'));
  });

  it('builds cluster when 3+ KB drivers share MEG linkage', () => {
    const rows = [
      {
        id: '1',
        source_system: 'centralr2',
        source_event_type: 'rental_analysis',
        summary: 'c2',
        event_time: '',
        ingested_at: '',
        actor_meg_entity_id: 'meg-1',
        related_entity_ids: [],
        autonomy_decision: null,
      },
      {
        id: '2',
        source_system: 'operator_workbench',
        source_event_type: 'friction_collapse_emitted',
        summary: 'works',
        event_time: '',
        ingested_at: '',
        actor_meg_entity_id: 'meg-1',
        related_entity_ids: [],
        autonomy_decision: null,
      },
      {
        id: '3',
        source_system: 'r2chart',
        source_event_type: 'continuity_signal',
        summary: 'chart',
        event_time: '',
        ingested_at: '',
        actor_meg_entity_id: 'meg-2',
        related_entity_ids: ['meg-1'],
        autonomy_decision: null,
      },
      {
        id: '4',
        source_system: 'ip_pulse_point',
        source_event_type: 'patent_analysis_complete',
        summary: 'ip',
        event_time: '',
        ingested_at: '',
        actor_meg_entity_id: 'meg-2',
        related_entity_ids: [],
        autonomy_decision: null,
      },
    ];
    const clusters = buildClustersFromRows(rows, [
      { source_entity_id: 'meg-1', target_entity_id: 'meg-2' },
    ]);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(clusters[0]!.drivers.size).toBeGreaterThanOrEqual(3);
    expect(extractMegIdsFromRow(rows[0]!)).toContain('meg-1');
  });

  it('does not merge distant MEG ids beyond 2-hop edge limit', () => {
    const chainEdges = [
      { source_entity_id: 'meg-a', target_entity_id: 'meg-b' },
      { source_entity_id: 'meg-b', target_entity_id: 'meg-c' },
      { source_entity_id: 'meg-c', target_entity_id: 'meg-d' },
    ];
    const reachable = megIdsWithinHops(['meg-a'], chainEdges, 2);
    expect(reachable.has('meg-a')).toBe(true);
    expect(reachable.has('meg-b')).toBe(true);
    expect(reachable.has('meg-c')).toBe(true);
    expect(reachable.has('meg-d')).toBe(false);

    const filtered = filterEdgesWithinMegHops(['meg-a'], chainEdges, 2);
    expect(filtered).toHaveLength(2);

    const rowA = {
      id: 'a',
      source_system: 'centralr2',
      source_event_type: 'rental_analysis',
      summary: 'a',
      event_time: '',
      ingested_at: '',
      actor_meg_entity_id: 'meg-a',
      related_entity_ids: [],
      autonomy_decision: null,
    };
    const rowD = {
      id: 'd',
      source_system: 'ip_pulse_point',
      source_event_type: 'patent_analysis_complete',
      summary: 'd',
      event_time: '',
      ingested_at: '',
      actor_meg_entity_id: 'meg-d',
      related_entity_ids: [],
      autonomy_decision: null,
    };
    const clusters = buildClustersFromRows([rowA, rowD], chainEdges);
    expect(clusters.length).toBe(0);
  });
});
