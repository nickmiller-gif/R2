export type KbDriverId = 'centralr2' | 'operator_workbench' | 'r2chart' | 'ip_pulse_point';

export type StewardFeedRow = {
  id: string;
  source_system: string;
  source_event_type: string;
  summary: string;
  event_time: string;
  ingested_at: string;
  actor_meg_entity_id: string | null;
  related_entity_ids: unknown;
  autonomy_decision: string | null;
};

export type MegEdge = {
  source_entity_id: string;
  target_entity_id: string;
};

const MIN_KB_DRIVERS = 3;

/** Max graph hops when unioning `meg_entity_edges` (plan: 2-hop neighborhood). */
export const MEG_EDGE_MAX_HOPS = 2;

function addAdjacency(adj: Map<string, Set<string>>, a: string, b: string): void {
  const left = adj.get(a) ?? new Set<string>();
  left.add(b);
  adj.set(a, left);
  const right = adj.get(b) ?? new Set<string>();
  right.add(a);
  adj.set(b, right);
}

/** MEG ids reachable from seeds within `maxHops` undirected edge walks. */
export function megIdsWithinHops(
  seeds: Iterable<string>,
  edges: MegEdge[],
  maxHops: number = MEG_EDGE_MAX_HOPS,
): Set<string> {
  const allowed = new Set<string>();
  let frontier = new Set<string>();
  for (const seed of seeds) {
    const id = seed.trim();
    if (!id) continue;
    allowed.add(id);
    frontier.add(id);
  }
  if (frontier.size === 0 || maxHops <= 0) return allowed;

  const adj = new Map<string, Set<string>>();
  for (const edge of edges) {
    const a = edge.source_entity_id?.trim();
    const b = edge.target_entity_id?.trim();
    if (!a || !b) continue;
    addAdjacency(adj, a, b);
  }

  for (let hop = 0; hop < maxHops; hop++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of adj.get(id) ?? []) {
        if (!allowed.has(neighbor)) {
          allowed.add(neighbor);
          next.add(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }
  return allowed;
}

export function filterEdgesWithinMegHops(
  seeds: Iterable<string>,
  edges: MegEdge[],
  maxHops: number = MEG_EDGE_MAX_HOPS,
): MegEdge[] {
  const allowed = megIdsWithinHops(seeds, edges, maxHops);
  return edges.filter((edge) => {
    const a = edge.source_entity_id?.trim();
    const b = edge.target_entity_id?.trim();
    return !!a && !!b && allowed.has(a) && allowed.has(b);
  });
}

const KB_DRIVER_BUCKETS: Record<KbDriverId, readonly string[]> = {
  centralr2: ['centralr2'],
  operator_workbench: ['operator_workbench', 'r2_works'],
  r2chart: ['r2chart', 'continuity_nexus'],
  ip_pulse_point: ['ip_pulse_point'],
};

const SMOKE_EVENT_TYPES = new Set([
  'stream_a_closeout',
  'kb_four_smoke',
  'r2.signal.ingest.probe',
  'futuristic_upgrade_scouted',
  'revolutionary_mesh_cycle_completed',
  'bot_finding_published',
]);

export function sourceSystemToKbDriver(sourceSystem: string): KbDriverId | null {
  for (const [driver, systems] of Object.entries(KB_DRIVER_BUCKETS) as [
    KbDriverId,
    readonly string[],
  ][]) {
    if (systems.includes(sourceSystem)) return driver;
  }
  return null;
}

export function countsTowardKbDriver(sourceSystem: string, eventType: string): KbDriverId | null {
  if (sourceSystem === 'autonomous_bot_os') return null;
  if (SMOKE_EVENT_TYPES.has(eventType)) return null;
  return sourceSystemToKbDriver(sourceSystem);
}

export class UnionFind {
  parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    this.add(id);
    let root = id;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let current = id;
    while (this.parent.get(current) !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }

  groups(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const list = map.get(root) ?? [];
      list.push(id);
      map.set(root, list);
    }
    return map;
  }
}

export function extractMegIdsFromRow(row: StewardFeedRow): string[] {
  const ids = new Set<string>();
  if (row.actor_meg_entity_id?.trim()) ids.add(row.actor_meg_entity_id.trim());
  if (Array.isArray(row.related_entity_ids)) {
    for (const entry of row.related_entity_ids) {
      if (typeof entry === 'string' && entry.trim()) ids.add(entry.trim());
    }
  }
  return Array.from(ids);
}

export function buildClustersFromRows(
  rows: StewardFeedRow[],
  edges: MegEdge[],
  options?: { maxEdgeHops?: number },
): Array<{
  rootId: string;
  megIds: Set<string>;
  rows: StewardFeedRow[];
  drivers: Set<KbDriverId>;
}> {
  const maxEdgeHops = options?.maxEdgeHops ?? MEG_EDGE_MAX_HOPS;
  const seedMegIds: string[] = [];
  for (const row of rows) {
    seedMegIds.push(...extractMegIdsFromRow(row));
  }
  const scopedEdges = filterEdgesWithinMegHops(seedMegIds, edges, maxEdgeHops);

  const uf = new UnionFind();
  const rowByMeg = new Map<string, StewardFeedRow[]>();

  for (const row of rows) {
    const megIds = extractMegIdsFromRow(row);
    if (megIds.length === 0) continue;
    for (const id of megIds) {
      uf.add(id);
      const bucket = rowByMeg.get(id) ?? [];
      bucket.push(row);
      rowByMeg.set(id, bucket);
    }
    for (let i = 1; i < megIds.length; i++) {
      uf.union(megIds[0]!, megIds[i]!);
    }
  }

  for (const edge of scopedEdges) {
    if (edge.source_entity_id && edge.target_entity_id) {
      uf.add(edge.source_entity_id);
      uf.add(edge.target_entity_id);
      uf.union(edge.source_entity_id, edge.target_entity_id);
    }
  }

  const groups = uf.groups();
  const clusters: Array<{
    rootId: string;
    megIds: Set<string>;
    rows: StewardFeedRow[];
    drivers: Set<KbDriverId>;
  }> = [];

  for (const [rootId, megIds] of groups) {
    const clusterRows = new Map<string, StewardFeedRow>();
    const drivers = new Set<KbDriverId>();

    for (const megId of megIds) {
      for (const row of rowByMeg.get(megId) ?? []) {
        clusterRows.set(row.id, row);
        const driver = countsTowardKbDriver(row.source_system, row.source_event_type);
        if (driver) drivers.add(driver);
      }
    }

    if (drivers.size >= MIN_KB_DRIVERS) {
      clusters.push({
        rootId,
        megIds: new Set(megIds),
        rows: Array.from(clusterRows.values()),
        drivers,
      });
    }
  }

  return clusters.sort((a, b) => b.rows.length - a.rows.length);
}
