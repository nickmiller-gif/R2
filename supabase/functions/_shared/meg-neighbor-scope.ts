import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  collectOneHopNeighborIds,
  MAX_MEG_NEIGHBOR_IDS,
  type MegEdgeEndpoint,
} from '../../../src/lib/eigen/meg-neighbor-scope.ts';
import { normalizeEntityScopeIds } from '../../../src/lib/eigen/chat-entity-context.ts';

const MAX_SEED_ENTITIES = 25;

export async function loadMegOneHopNeighborIds(
  client: SupabaseClient,
  entityScope: string[],
): Promise<string[]> {
  const seeds = normalizeEntityScopeIds(entityScope, MAX_SEED_ENTITIES);
  if (seeds.length === 0) return [];

  const { data, error } = await client
    .from('meg_entity_edges')
    .select('source_entity_id,target_entity_id')
    .or(`source_entity_id.in.(${seeds.join(',')}),target_entity_id.in.(${seeds.join(',')})`)
    .limit(500);

  if (error || !data) return [];

  const edges = (data as MegEdgeEndpoint[]).filter(
    (row) => typeof row.source_entity_id === 'string' && typeof row.target_entity_id === 'string',
  );
  return collectOneHopNeighborIds(seeds, edges, MAX_MEG_NEIGHBOR_IDS);
}
