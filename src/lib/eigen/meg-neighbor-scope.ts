/**
 * MEG graph 1-hop neighbor expansion for graph-aware retrieval boost (X1).
 */

export const MAX_MEG_NEIGHBOR_IDS = 50;

export interface MegEdgeEndpoint {
  source_entity_id: string;
  target_entity_id: string;
}

/** Collect distinct 1-hop neighbor entity ids reachable from seed scope via undirected edges. */
export function collectOneHopNeighborIds(
  seedEntityIds: string[],
  edges: MegEdgeEndpoint[],
  maxNeighbors: number = MAX_MEG_NEIGHBOR_IDS,
): string[] {
  const seeds = new Set(seedEntityIds.map((id) => id.trim()).filter((id) => id.length > 0));
  if (seeds.size === 0) return [];

  const neighbors = new Set<string>();
  for (const edge of edges) {
    const source = edge.source_entity_id?.trim();
    const target = edge.target_entity_id?.trim();
    if (!source || !target) continue;
    if (seeds.has(source) && !seeds.has(target)) neighbors.add(target);
    if (seeds.has(target) && !seeds.has(source)) neighbors.add(source);
    if (neighbors.size >= maxNeighbors) break;
  }

  return [...neighbors].slice(0, maxNeighbors);
}
