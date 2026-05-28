/**
 * Eigen chat — resolve MEG entity scope from explicit UUIDs, labels, and message hints.
 * Deno-free for Vitest and edge-function sharing.
 */

import { isValidMegEntityId, normalizeEntityScopeIds } from './chat-entity-context.ts';

export type EntityScopeMode = 'filter' | 'boost';
export type EntityScopeResolutionSource = 'explicit' | 'label' | 'message';

export interface EntityLookupHit {
  id: string;
  score: number;
  source: EntityScopeResolutionSource;
  matchedText: string;
}

export interface ResolvedChatEntityScope {
  entityIds: string[];
  resolutionSources: EntityScopeResolutionSource[];
  scopeMode: EntityScopeMode;
  lookupHits: EntityLookupHit[];
}

const MIN_HINT_LENGTH = 2;
const MAX_HINT_LENGTH = 120;

/** Collect human-readable strings worth querying against MEG aliases / canonical names. */
export function collectEntityLookupHints(message: string, entityLabel?: string): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined) => {
    const trimmed = raw?.replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed.length < MIN_HINT_LENGTH || trimmed.length > MAX_HINT_LENGTH) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    hints.push(trimmed);
  };

  push(entityLabel);

  for (const match of message.matchAll(/"([^"]{2,80})"|'([^']{2,80})'/g)) {
    push(match[1] ?? match[2]);
  }

  if (entityLabel) return hints.slice(0, 4);

  const withoutUrls = message.replace(/https?:\/\/\S+/gi, ' ');
  const capitalPhrase = withoutUrls.match(
    /\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,4})\b/,
  );
  if (capitalPhrase?.[1]) push(capitalPhrase[1]);

  return hints.slice(0, 4);
}

export function scoreEntityLookupHit(input: {
  hint: string;
  matchedText: string;
  source: EntityScopeResolutionSource;
  confidence?: number;
  exact: boolean;
}): number {
  const hint = input.hint.trim().toLowerCase();
  const matched = input.matchedText.trim().toLowerCase();
  let score = input.exact ? 1 : 0.55;
  if (matched === hint) score += 0.35;
  else if (matched.startsWith(hint) || hint.startsWith(matched)) score += 0.15;
  if (input.source === 'label') score += 0.2;
  if (typeof input.confidence === 'number' && Number.isFinite(input.confidence)) {
    score += Math.min(0.2, input.confidence / 500);
  }
  return score;
}

export function rankEntityLookupHits(hits: EntityLookupHit[], max = 8): EntityLookupHit[] {
  const byId = new Map<string, EntityLookupHit>();
  for (const hit of hits) {
    if (!isValidMegEntityId(hit.id)) continue;
    const existing = byId.get(hit.id);
    if (!existing || hit.score > existing.score) byId.set(hit.id, hit);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

export function mergeExplicitAndResolvedScope(
  explicitScope: string[],
  resolvedHits: EntityLookupHit[],
  max = 8,
): ResolvedChatEntityScope {
  const explicit = normalizeEntityScopeIds(explicitScope, max);
  if (explicit.length > 0) {
    return {
      entityIds: explicit,
      resolutionSources: ['explicit'],
      scopeMode: 'filter',
      lookupHits: explicit.map((id) => ({
        id,
        score: 1,
        source: 'explicit',
        matchedText: id,
      })),
    };
  }

  const ranked = rankEntityLookupHits(resolvedHits, max);
  const entityIds = ranked.map((hit) => hit.id);
  const resolutionSources = [
    ...new Set(ranked.map((hit) => hit.source)),
  ] as EntityScopeResolutionSource[];

  return {
    entityIds,
    resolutionSources,
    scopeMode: entityIds.length > 0 ? 'boost' : 'filter',
    lookupHits: ranked,
  };
}

export function resolveEntityScopeMode(
  explicitScope: string[],
  requestedMode: EntityScopeMode | undefined,
  resolved: ResolvedChatEntityScope,
): EntityScopeMode {
  if (requestedMode === 'filter' || requestedMode === 'boost') return requestedMode;
  if (normalizeEntityScopeIds(explicitScope).length > 0) return 'filter';
  return resolved.scopeMode;
}
