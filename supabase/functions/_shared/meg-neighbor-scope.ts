import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  collectOneHopNeighborIds,
  MAX_MEG_NEIGHBOR_EDGE_ROWS,
  MAX_MEG_NEIGHBOR_IDS,
  MAX_MEG_NEIGHBOR_SEED_ENTITIES,
  type MegEdgeEndpoint,
} from '../../../src/lib/eigen/meg-neighbor-scope.ts';
import { normalizeEntityScopeIds } from '../../../src/lib/eigen/chat-entity-context.ts';

const DEFAULT_NEIGHBOR_LOAD_TIMEOUT_MS = 1200;

function readMegNeighborLoadTimeoutMs(): number {
  const raw =
    Deno.env.get('EIGEN_MEG_NEIGHBOR_LOAD_TIMEOUT_MS') ?? String(DEFAULT_NEIGHBOR_LOAD_TIMEOUT_MS);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 200) return DEFAULT_NEIGHBOR_LOAD_TIMEOUT_MS;
  return Math.min(parsed, 5000);
}

function readMegNeighborEdgeLimit(): number {
  const raw = Deno.env.get('EIGEN_MEG_NEIGHBOR_EDGE_LIMIT') ?? String(MAX_MEG_NEIGHBOR_EDGE_ROWS);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 50) return MAX_MEG_NEIGHBOR_EDGE_ROWS;
  return Math.min(parsed, 1000);
}

async function withNeighborLoadTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('meg neighbor load timed out')), ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function mergeEdgeRows(rows: MegEdgeEndpoint[]): MegEdgeEndpoint[] {
  const seen = new Set<string>();
  const out: MegEdgeEndpoint[] = [];
  for (const row of rows) {
    const source = row.source_entity_id?.trim();
    const target = row.target_entity_id?.trim();
    if (!source || !target) continue;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source_entity_id: source, target_entity_id: target });
  }
  return out;
}

async function fetchMegEdgesForSeeds(
  client: SupabaseClient,
  seeds: string[],
  edgeLimit: number,
): Promise<MegEdgeEndpoint[]> {
  const perQueryLimit = Math.max(50, Math.ceil(edgeLimit / 2));
  const [bySource, byTarget] = await Promise.all([
    client
      .from('meg_entity_edges')
      .select('source_entity_id,target_entity_id')
      .in('source_entity_id', seeds)
      .limit(perQueryLimit),
    client
      .from('meg_entity_edges')
      .select('source_entity_id,target_entity_id')
      .in('target_entity_id', seeds)
      .limit(perQueryLimit),
  ]);

  if (bySource.error && byTarget.error) return [];

  const merged = mergeEdgeRows([
    ...((bySource.data ?? []) as MegEdgeEndpoint[]),
    ...((byTarget.data ?? []) as MegEdgeEndpoint[]),
  ]);
  return merged.slice(0, edgeLimit);
}

/** Fail-open: returns [] on timeout or DB error. */
export async function loadMegOneHopNeighborIds(
  client: SupabaseClient,
  entityScope: string[],
): Promise<string[]> {
  const seeds = normalizeEntityScopeIds(entityScope, MAX_MEG_NEIGHBOR_SEED_ENTITIES);
  if (seeds.length === 0) return [];

  try {
    const edges = await withNeighborLoadTimeout(
      fetchMegEdgesForSeeds(client, seeds, readMegNeighborEdgeLimit()),
      readMegNeighborLoadTimeoutMs(),
    );
    return collectOneHopNeighborIds(seeds, edges, MAX_MEG_NEIGHBOR_IDS);
  } catch {
    return [];
  }
}
