import type { Alias, AliasKind, EntityRef } from '../../types/shared/identity.js';

/**
 * Creates an Alias for the given EntityRef.
 */
export function makeAlias(entityRef: EntityRef, aliasKind: AliasKind, value: string): Alias {
  return { entityRef, aliasKind, value };
}

/**
 * Returns the first alias matching the requested kind, or undefined if none.
 */
export function findAlias(aliases: Alias[], aliasKind: AliasKind): Alias | undefined {
  return aliases.find((a) => a.aliasKind === aliasKind);
}

/**
 * Builds a lookup map keyed by `<aliasKind>:<value>` for O(1) resolution.
 * When duplicate keys exist the last occurrence wins.
 */
export function aliasIndex(aliases: Alias[]): Map<string, Alias> {
  const map = new Map<string, Alias>();
  for (const alias of aliases) {
    map.set(`${alias.aliasKind}:${alias.value}`, alias);
  }
  return map;
}
