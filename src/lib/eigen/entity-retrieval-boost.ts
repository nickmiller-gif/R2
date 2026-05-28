/**
 * Soft entity scoping for Eigen retrieval — boost tagged chunks instead of hard-filtering.
 */

export type EntityScopeMode = 'filter' | 'boost';

export const DEFAULT_ENTITY_SCOPE_BOOST = 0.07;

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

export function shouldHardFilterEntityScope(
  entityScope: string[] | undefined,
  mode: EntityScopeMode | undefined,
): boolean {
  if (!entityScope?.length) return false;
  return (mode ?? 'filter') === 'filter';
}
