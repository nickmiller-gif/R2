import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type ChatEntityForPrompt,
  normalizeEntityScopeIds,
} from '../../../src/lib/eigen/chat-entity-context.ts';

interface MegEntityRow {
  id: string;
  entity_type: string;
  canonical_name: string;
  status: string;
  attributes: Record<string, unknown> | null;
  enrichment_consensus: Record<string, unknown> | null;
  merged_into_id: string | null;
}

interface MegProjectionRow {
  meg_entity_id: string;
  fields: Record<string, unknown> | null;
  last_source_system: string;
  updated_at: string;
}

interface MegSourceRefRow {
  meg_entity_id: string;
  source_table: string | null;
  source_system: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sourceLabelsForEntity(entityId: string, refs: MegSourceRefRow[]): string[] {
  const labels = new Set<string>();
  for (const ref of refs) {
    if (ref.meg_entity_id !== entityId) continue;
    if (ref.source_table) labels.add(ref.source_table);
    if (ref.source_system) labels.add(ref.source_system);
  }
  return [...labels];
}

export async function fetchMegEntityContextForChat(
  client: SupabaseClient,
  entityScope: string[],
  maxEntities = 8,
): Promise<ChatEntityForPrompt[]> {
  const ids = normalizeEntityScopeIds(entityScope, maxEntities);
  if (ids.length === 0) return [];

  const [entitiesResult, projectionsResult, refsResult] = await Promise.all([
    client
      .from('meg_entities')
      .select(
        'id, entity_type, canonical_name, status, attributes, enrichment_consensus, merged_into_id',
      )
      .in('id', ids)
      .eq('status', 'active'),
    client
      .from('meg_entity_projections')
      .select('meg_entity_id, fields, last_source_system, updated_at')
      .in('meg_entity_id', ids),
    client
      .from('meg_entity_source_refs')
      .select('meg_entity_id, source_table, source_system')
      .in('meg_entity_id', ids),
  ]);

  if (entitiesResult.error) {
    throw new Error(`Failed to load MEG entities: ${entitiesResult.error.message}`);
  }

  const entities = (entitiesResult.data ?? []) as MegEntityRow[];
  const projections = (projectionsResult.data ?? []) as MegProjectionRow[];
  const refs = (refsResult.data ?? []) as MegSourceRefRow[];

  const projectionById = new Map(projections.map((row) => [row.meg_entity_id, row]));
  const entityById = new Map(entities.map((row) => [row.id, row]));

  return ids
    .map((id) => entityById.get(id))
    .filter((row): row is MegEntityRow => Boolean(row))
    .map((row) => {
      const projection = projectionById.get(row.id);
      return {
        id: row.id,
        entityType: row.entity_type,
        canonicalName: row.canonical_name,
        status: row.status,
        fields: asRecord(projection?.fields),
        attributes: asRecord(row.attributes),
        enrichmentConsensus: asRecord(row.enrichment_consensus),
        lastSourceSystem: projection?.last_source_system,
        lastUpdatedAt: projection?.updated_at,
        sourceLabels: sourceLabelsForEntity(row.id, refs),
      } satisfies ChatEntityForPrompt;
    });
}
