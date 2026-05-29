import { describe, expect, it } from 'vitest';
import {
  computeGraphAwareEntityBoost,
  computeEntityScopeBoost,
  entityScopeMatchesChunk,
  shouldHardFilterEntityScope,
} from '../../src/lib/eigen/entity-retrieval-boost.ts';
import {
  collectOneHopNeighborIds,
  MAX_MEG_NEIGHBOR_IDS,
} from '../../src/lib/eigen/meg-neighbor-scope.ts';

const ENTITY_A = '550e8400-e29b-41d4-a716-446655440000';
const ENTITY_B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const ENTITY_C = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

describe('entity-retrieval-boost', () => {
  it('detects chunk overlap with entity scope', () => {
    expect(entityScopeMatchesChunk([ENTITY_A], [ENTITY_B, ENTITY_A])).toBe(true);
    expect(entityScopeMatchesChunk([ENTITY_A], [ENTITY_B])).toBe(false);
  });

  it('boosts only in boost mode when overlap exists', () => {
    expect(computeEntityScopeBoost([ENTITY_A], [ENTITY_A], 'boost')).toBeGreaterThan(0);
    expect(computeEntityScopeBoost([ENTITY_A], [ENTITY_A], 'filter')).toBe(0);
    expect(computeEntityScopeBoost([ENTITY_A], [ENTITY_B], 'boost')).toBe(0);
  });

  it('hard-filters only in filter mode with scope', () => {
    expect(shouldHardFilterEntityScope([ENTITY_A], 'filter')).toBe(true);
    expect(shouldHardFilterEntityScope([ENTITY_A], 'boost')).toBe(false);
    expect(shouldHardFilterEntityScope([], 'filter')).toBe(false);
  });
});

describe('graph-aware entity boost (X1)', () => {
  it('applies direct boost for primary scope match', () => {
    expect(
      computeGraphAwareEntityBoost([ENTITY_A], [ENTITY_B], [ENTITY_A], 'boost', 0.07, 0.035),
    ).toBe(0.07);
  });

  it('applies softer neighbor boost when chunk matches neighbor only', () => {
    expect(
      computeGraphAwareEntityBoost([ENTITY_A], [ENTITY_B], [ENTITY_B], 'boost', 0.07, 0.035),
    ).toBe(0.035);
  });

  it('returns zero when neighbor boost is disabled', () => {
    expect(computeGraphAwareEntityBoost([ENTITY_A], [ENTITY_B], [ENTITY_B], 'boost', 0.07, 0)).toBe(
      0,
    );
  });

  it('returns zero in filter mode', () => {
    expect(
      computeGraphAwareEntityBoost([ENTITY_A], [ENTITY_B], [ENTITY_B], 'filter', 0.07, 0.035),
    ).toBe(0);
  });

  it('does not double-count when chunk matches both primary and neighbor lists', () => {
    expect(
      computeGraphAwareEntityBoost(
        [ENTITY_A],
        [ENTITY_A, ENTITY_B],
        [ENTITY_A],
        'boost',
        0.07,
        0.035,
      ),
    ).toBe(0.07);
  });
});

describe('meg-neighbor-scope', () => {
  it('collects undirected 1-hop neighbors excluding seeds', () => {
    const edges = [
      { source_entity_id: ENTITY_A, target_entity_id: ENTITY_B },
      { source_entity_id: ENTITY_B, target_entity_id: ENTITY_C },
    ];
    expect(collectOneHopNeighborIds([ENTITY_A], edges)).toEqual([ENTITY_B]);
    expect(collectOneHopNeighborIds([ENTITY_A, ENTITY_C], edges).sort()).toEqual([ENTITY_B].sort());
  });

  it('returns empty when there are no edges', () => {
    expect(collectOneHopNeighborIds([ENTITY_A], [])).toEqual([]);
  });

  it('respects max neighbor cap', () => {
    const edges = Array.from({ length: MAX_MEG_NEIGHBOR_IDS + 5 }, (_, index) => ({
      source_entity_id: ENTITY_A,
      target_entity_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    expect(collectOneHopNeighborIds([ENTITY_A], edges).length).toBe(MAX_MEG_NEIGHBOR_IDS);
  });
});
