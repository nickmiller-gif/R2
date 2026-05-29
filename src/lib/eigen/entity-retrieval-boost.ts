/**
 * Soft entity scoping for Eigen retrieval — boost tagged chunks instead of hard-filtering.
 */

export type EntityScopeMode = 'filter' | 'boost';

export const DEFAULT_ENTITY_SCOPE_BOOST = 0.07;
export const DEFAULT_MEG_NEIGHBOR_BOOST = 0.035;

export function entityScopeMatchesChunk(entityScope: string[], chunkEntityIds: string[]): boolean {
  if (entityScope.length === 0 || chunkEntityIds.length === 0) return false;
  const scope = new Set(entityScope);
  return chunkEntityIds.some((id) => scope.has(id));
}

export function computeEntityScopeBoost(
  entityScope: string[],
  chunkEntityIds: string[],
  mode: EntityScopeMode,
  boostAmount = DEFAULT_ENTITY_SCOPE_BOOST,
): number {
  if (mode !== 'boost' || entityScope.length === 0) return 0;
  return entityScopeMatchesChunk(entityScope, chunkEntityIds) ? boostAmount : 0;
}

/**
 * Graph-aware entity boost: full weight for direct scope match, softer weight for
 * 1-hop MEG neighbors when the chunk does not already match the primary scope.
 */
export function computeGraphAwareEntityBoost(
  entityScope: string[],
  neighborScope: string[],
  chunkEntityIds: string[],
  mode: EntityScopeMode,
  directBoost = DEFAULT_ENTITY_SCOPE_BOOST,
  neighborBoost = DEFAULT_MEG_NEIGHBOR_BOOST,
): number {
  if (mode !== 'boost' || entityScope.length === 0) return 0;
  if (entityScopeMatchesChunk(entityScope, chunkEntityIds)) return directBoost;
  if (neighborBoost <= 0 || neighborScope.length === 0) return 0;

  const primary = new Set(entityScope);
  const neighborsOnly = neighborScope.filter((id) => !primary.has(id));
  if (neighborsOnly.length === 0) return 0;
  return entityScopeMatchesChunk(neighborsOnly, chunkEntityIds) ? neighborBoost : 0;
}

export function shouldHardFilterEntityScope(
  entityScope: string[] | undefined,
  mode: EntityScopeMode | undefined,
): boolean {
  if (!entityScope?.length) return false;
  return (mode ?? 'filter') === 'filter';
}
