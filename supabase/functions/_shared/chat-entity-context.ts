import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type ChatEntityForPrompt,
  type ChatEntityRelationship,
  normalizeEntityScopeIds,
} from '../../../src/lib/eigen/chat-entity-context.ts';
import {
  collectEntityLookupHints,
  mergeExplicitAndResolvedScope,
  rankEntityLookupHits,
  resolveEntityScopeMode,
  scoreEntityLookupHit,
  type EntityLookupHit,
  type EntityScopeMode,
  type ResolvedChatEntityScope,
} from '../../../src/lib/eigen/chat-entity-resolver.ts';

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

interface MegFullContextEdge {
  edge_type?: string;
  direction?: 'out' | 'in';
  other_meg_entity_id?: string;
  confidence?: number | null;
}

export interface ResolveChatEntityScopeInput {
  message: string;
  explicitScope: string[];
  entityLabel?: string;
  entityScopeMode?: EntityScopeMode;
  maxEntities?: number;
}

export interface ResolveChatEntityScopeResult extends ResolvedChatEntityScope {
  scopeMode: EntityScopeMode;
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

function sidecarTableForEntityType(entityType: string): string | null {
  switch (entityType.trim().toLowerCase()) {
    case 'org':
      return 'meg_company_sidecar';
    case 'property':
      return 'meg_property_sidecar';
    case 'person':
      return 'meg_person_contact_sidecar';
    default:
      return null;
  }
}

async function followMergedIntoIds(
  client: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const redirect = new Map<string, string>();
  let pending = [...ids];
  const seen = new Set<string>();

  for (let hop = 0; hop < 3 && pending.length > 0; hop++) {
    const batch = pending.filter((id) => !seen.has(id));
    pending = [];
    if (batch.length === 0) break;

    for (const id of batch) seen.add(id);

    const { data, error } = await client
      .from('meg_entities')
      .select('id, status, merged_into_id')
      .in('id', batch);
    if (error) throw new Error(`Failed to resolve merged MEG entities: ${error.message}`);

    for (const row of data ?? []) {
      const id = String(row.id);
      const status = String(row.status);
      const mergedInto =
        typeof row.merged_into_id === 'string' && row.merged_into_id.length > 0
          ? row.merged_into_id
          : null;

      if (status === 'merged' && mergedInto) {
        redirect.set(id, mergedInto);
        if (!seen.has(mergedInto)) pending.push(mergedInto);
      } else {
        redirect.set(id, id);
      }
    }
  }

  for (const id of ids) {
    if (!redirect.has(id)) redirect.set(id, id);
  }
  return redirect;
}

async function lookupEntityHitsByHint(
  client: SupabaseClient,
  hint: string,
  source: EntityLookupHit['source'],
): Promise<EntityLookupHit[]> {
  const trimmed = hint.trim();
  if (trimmed.length < 2) return [];

  const [aliasExact, nameExact, aliasFuzzy, nameFuzzy] = await Promise.all([
    client
      .from('meg_entity_aliases')
      .select('meg_entity_id, alias_value, confidence')
      .eq('alias_value', trimmed)
      .limit(6),
    client
      .from('meg_entities')
      .select('id, canonical_name')
      .eq('status', 'active')
      .eq('canonical_name', trimmed)
      .limit(6),
    trimmed.length >= 3
      ? client
          .from('meg_entity_aliases')
          .select('meg_entity_id, alias_value, confidence')
          .ilike('alias_value', `%${trimmed}%`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    trimmed.length >= 3
      ? client
          .from('meg_entities')
          .select('id, canonical_name')
          .eq('status', 'active')
          .ilike('canonical_name', `%${trimmed}%`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const candidateIds = new Set<string>();
  const hits: EntityLookupHit[] = [];

  const pushHit = (id: string, matchedText: string, exact: boolean, confidence?: number) => {
    candidateIds.add(id);
    hits.push({
      id,
      score: scoreEntityLookupHit({ hint: trimmed, matchedText, source, confidence, exact }),
      source,
      matchedText,
    });
  };

  for (const row of aliasExact.data ?? []) {
    pushHit(String(row.meg_entity_id), String(row.alias_value), true, Number(row.confidence));
  }
  for (const row of nameExact.data ?? []) {
    pushHit(String(row.id), String(row.canonical_name), true);
  }
  for (const row of aliasFuzzy.data ?? []) {
    pushHit(String(row.meg_entity_id), String(row.alias_value), false, Number(row.confidence));
  }
  for (const row of nameFuzzy.data ?? []) {
    pushHit(String(row.id), String(row.canonical_name), false);
  }

  if (candidateIds.size === 0) return [];

  const { data: activeRows, error: activeError } = await client
    .from('meg_entities')
    .select('id')
    .in('id', [...candidateIds])
    .eq('status', 'active');
  if (activeError) {
    throw new Error(`Failed to filter active MEG entities: ${activeError.message}`);
  }

  const activeIds = new Set((activeRows ?? []).map((row) => String(row.id)));
  return hits.filter((hit) => activeIds.has(hit.id));
}

export async function resolveChatEntityScope(
  client: SupabaseClient,
  input: ResolveChatEntityScopeInput,
): Promise<ResolveChatEntityScopeResult> {
  const hints = collectEntityLookupHints(input.message, input.entityLabel);
  const resolvedHits: EntityLookupHit[] = [];

  for (const hint of hints) {
    const source: EntityLookupHit['source'] =
      input.entityLabel && hint.trim().toLowerCase() === input.entityLabel.trim().toLowerCase()
        ? 'label'
        : 'message';
    const hits = await lookupEntityHitsByHint(client, hint, source);
    resolvedHits.push(...hits);
  }

  const merged = mergeExplicitAndResolvedScope(
    input.explicitScope,
    rankEntityLookupHits(resolvedHits, input.maxEntities ?? 8),
    input.maxEntities ?? 8,
  );

  const redirect = await followMergedIntoIds(client, merged.entityIds);
  const entityIds = normalizeEntityScopeIds(
    merged.entityIds.map((id) => redirect.get(id) ?? id),
    input.maxEntities ?? 8,
  );

  return {
    ...merged,
    entityIds,
    scopeMode: resolveEntityScopeMode(input.explicitScope, input.entityScopeMode, merged),
  };
}

async function loadSidecarFields(
  client: SupabaseClient,
  entityType: string,
  entityId: string,
): Promise<Record<string, unknown>> {
  const table = sidecarTableForEntityType(entityType);
  if (!table) return {};

  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('meg_entity_id', entityId)
    .maybeSingle();
  if (error || !data) return {};

  const { meg_entity_id: _id, updated_at: _updatedAt, ...rest } = data as Record<string, unknown>;
  return rest;
}

function mapEdgesToRelationships(
  edges: MegFullContextEdge[],
  neighborById: Map<string, MegEntityRow>,
): ChatEntityRelationship[] {
  return edges
    .filter((edge) => typeof edge.other_meg_entity_id === 'string')
    .map((edge) => {
      const otherId = edge.other_meg_entity_id as string;
      const neighbor = neighborById.get(otherId);
      return {
        edgeType: String(edge.edge_type ?? 'related'),
        direction: edge.direction === 'in' ? 'in' : 'out',
        otherEntityId: otherId,
        otherEntityName: neighbor?.canonical_name,
        otherEntityType: neighbor?.entity_type,
        confidence: edge.confidence ?? null,
      } satisfies ChatEntityRelationship;
    });
}

export async function fetchMegEntityContextForChat(
  client: SupabaseClient,
  entityScope: string[],
  maxEntities = 8,
): Promise<ChatEntityForPrompt[]> {
  const ids = normalizeEntityScopeIds(entityScope, maxEntities);
  if (ids.length === 0) return [];

  const redirect = await followMergedIntoIds(client, ids);
  const resolvedIds = normalizeEntityScopeIds(
    ids.map((id) => redirect.get(id) ?? id),
    maxEntities,
  );
  if (resolvedIds.length === 0) return [];

  const [entitiesResult, projectionsResult, refsResult, fullContexts] = await Promise.all([
    client
      .from('meg_entities')
      .select(
        'id, entity_type, canonical_name, status, attributes, enrichment_consensus, merged_into_id',
      )
      .in('id', resolvedIds)
      .eq('status', 'active'),
    client
      .from('meg_entity_projections')
      .select('meg_entity_id, fields, last_source_system, updated_at')
      .in('meg_entity_id', resolvedIds),
    client
      .from('meg_entity_source_refs')
      .select('meg_entity_id, source_table, source_system')
      .in('meg_entity_id', resolvedIds),
    Promise.all(
      resolvedIds.map(async (id) => {
        const { data, error } = await client.rpc('meg_entity_full_context', {
          p_meg_entity_id: id,
        });
        if (error || !data || typeof data !== 'object')
          return { id, edges: [] as MegFullContextEdge[] };
        const payload = data as Record<string, unknown>;
        const edges = Array.isArray(payload.meg_entity_edges)
          ? (payload.meg_entity_edges as MegFullContextEdge[])
          : [];
        return { id, edges };
      }),
    ),
  ]);

  if (entitiesResult.error) {
    throw new Error(`Failed to load MEG entities: ${entitiesResult.error.message}`);
  }

  const entities = (entitiesResult.data ?? []) as MegEntityRow[];
  const projections = (projectionsResult.data ?? []) as MegProjectionRow[];
  const refs = (refsResult.data ?? []) as MegSourceRefRow[];
  const edgesById = new Map(fullContexts.map((entry) => [entry.id, entry.edges]));

  const neighborIds = [
    ...new Set(
      fullContexts.flatMap((entry) =>
        entry.edges
          .map((edge) => edge.other_meg_entity_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ),
  ];

  const neighborResult =
    neighborIds.length > 0
      ? await client
          .from('meg_entities')
          .select(
            'id, entity_type, canonical_name, status, attributes, enrichment_consensus, merged_into_id',
          )
          .in('id', neighborIds)
      : { data: [] as MegEntityRow[], error: null };
  if (neighborResult.error) {
    throw new Error(`Failed to load MEG relationship neighbors: ${neighborResult.error.message}`);
  }

  const neighborById = new Map(
    ((neighborResult.data ?? []) as MegEntityRow[]).map((row) => [row.id, row]),
  );

  const projectionById = new Map(projections.map((row) => [row.meg_entity_id, row]));
  const entityById = new Map(entities.map((row) => [row.id, row]));

  const sidecars = await Promise.all(
    resolvedIds.map(async (id) => {
      const entity = entityById.get(id);
      if (!entity) return { id, fields: {} as Record<string, unknown> };
      const fields = await loadSidecarFields(client, entity.entity_type, id);
      return { id, fields };
    }),
  );
  const sidecarById = new Map(sidecars.map((entry) => [entry.id, entry.fields]));

  return resolvedIds
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
        sidecarFields: sidecarById.get(row.id) ?? {},
        relationships: mapEdgesToRelationships(edgesById.get(row.id) ?? [], neighborById),
        lastSourceSystem: projection?.last_source_system,
        lastUpdatedAt: projection?.updated_at,
        sourceLabels: sourceLabelsForEntity(row.id, refs),
      } satisfies ChatEntityForPrompt;
    });
}
