import { describe, expect, it } from 'vitest';
import {
  computeEntityScopeBoost,
  entityScopeMatchesChunk,
  shouldHardFilterEntityScope,
} from '../../src/lib/eigen/entity-retrieval-boost.ts';

const ENTITY_A = '550e8400-e29b-41d4-a716-446655440000';
const ENTITY_B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
