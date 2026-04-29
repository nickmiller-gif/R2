import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { isUuidString, requireIdempotencyKey } from '../_shared/validate.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      const id = lastSegment === 'meg-entities' ? null : lastSegment;
      const action = url.searchParams.get('action');

      const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

      const entitySelect =
        'attributes,canonical_name,created_at,entity_type,external_ids,id,merged_into_id,metadata,profile_id,status,updated_at';

      if (req.method === 'GET') {
        if (!id && action === 'resolve_bundle') {
          const userClient = getSupabaseClient(req);
          const alias = url.searchParams.get('alias')?.trim() ?? '';
          const entityIdParam = url.searchParams.get('entity_id')?.trim() ?? '';
          const includeNeighbors =
            url.searchParams.get('include_neighbors') === 'true' ||
            url.searchParams.get('include_neighbors') === '1';

          if (!alias && !entityIdParam) {
            return errorResponse('Provide alias or entity_id for resolve_bundle', 400);
          }
          if (entityIdParam && !isUuidString(entityIdParam)) {
            return errorResponse('entity_id must be a UUID', 400);
          }
          if (alias.length > 512) {
            return errorResponse('alias exceeds maximum length (512)', 400);
          }

          let entity: Record<string, unknown>;
          let matchedVia: 'entity_id' | 'alias';

          if (entityIdParam) {
            const res = await userClient
              .from('meg_entities')
              .select(entitySelect)
              .eq('id', entityIdParam)
              .eq('status', 'active')
              .maybeSingle();
            if (res.error) return errorResponse(res.error.message, 400);
            if (!res.data) return errorResponse('Entity not found', 404);
            entity = res.data as Record<string, unknown>;
            matchedVia = 'entity_id';
          } else {
            const aliasRes = await userClient
              .from('meg_entity_aliases')
              .select('meg_entity_id, confidence')
              .eq('alias_value', alias)
              .order('confidence', { ascending: false });
            if (aliasRes.error) return errorResponse(aliasRes.error.message, 400);
            const hits = (aliasRes.data ?? []) as Array<{
              meg_entity_id: string;
              confidence: number;
            }>;
            let found: Record<string, unknown> | null = null;
            for (const hit of hits) {
              const entRes = await userClient
                .from('meg_entities')
                .select(entitySelect)
                .eq('id', hit.meg_entity_id)
                .eq('status', 'active')
                .maybeSingle();
              if (entRes.error) return errorResponse(entRes.error.message, 400);
              if (entRes.data) {
                found = entRes.data as Record<string, unknown>;
                break;
              }
            }
            if (!found) return errorResponse('No active entity for alias', 404);
            entity = found;
            matchedVia = 'alias';
          }

          const resolvedId = entity.id as string;
          let neighbors: unknown[] = [];
          if (includeNeighbors) {
            const edgeRes = await userClient
              .from('meg_entity_edges')
              .select('source_entity_id, target_entity_id, edge_type, confidence')
              .or(`source_entity_id.eq.${resolvedId},target_entity_id.eq.${resolvedId}`);
            if (edgeRes.error) return errorResponse(edgeRes.error.message, 400);
            const edges = (edgeRes.data ?? []) as Array<{
              source_entity_id: string;
              target_entity_id: string;
              edge_type: string;
              confidence: number;
            }>;
            const otherIds = [
              ...new Set(
                edges.map((e) =>
                  e.source_entity_id === resolvedId ? e.target_entity_id : e.source_entity_id,
                ),
              ),
            ];
            const entityById = new Map<string, Record<string, unknown>>();
            if (otherIds.length > 0) {
              const entsRes = await userClient
                .from('meg_entities')
                .select(entitySelect)
                .in('id', otherIds)
                .eq('status', 'active');
              if (entsRes.error) return errorResponse(entsRes.error.message, 400);
              for (const row of entsRes.data ?? []) {
                entityById.set((row as { id: string }).id, row as Record<string, unknown>);
              }
            }
            neighbors = edges.map((e) => {
              const outgoing = e.source_entity_id === resolvedId;
              const otherId = outgoing ? e.target_entity_id : e.source_entity_id;
              return {
                entity: entityById.get(otherId) ?? null,
                edge_type: e.edge_type,
                direction: outgoing ? 'outgoing' : 'incoming',
                confidence: e.confidence,
              };
            });
          }

          return jsonResponse({ entity, matched_via: matchedVia, neighbors });
        }

        if (id) {
          const { data, error } = await client
            .from('meg_entities')
            .select(entitySelect)
            .eq('id', id)
            .single();
          if (error) return errorResponse(error.message, 404);
          return jsonResponse(data);
        } else {
          const profileId = url.searchParams.get('profile_id');
          const entityType = url.searchParams.get('entity_type');
          const status = url.searchParams.get('status');
          const canonicalNameLike = url.searchParams.get('canonical_name_like');

          let query = client.from('meg_entities').select(entitySelect);
          if (profileId) query = query.eq('profile_id', profileId);
          if (entityType) query = query.eq('entity_type', entityType);
          if (status) query = query.eq('status', status);
          if (canonicalNameLike) query = query.ilike('canonical_name', `%${canonicalNameLike}%`);

          const { data, error } = await query;
          if (error) return errorResponse(error.message, 400);
          return jsonResponse(data);
        }
      } else if (req.method === 'POST') {
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;
        const body = await req.json();

        if (action === 'merge') {
          // MERGE source entity into target entity
          const { sourceId, targetId } = body;
          if (!sourceId || !targetId) {
            return errorResponse('sourceId and targetId are required', 400);
          }

          const { data, error } = await client
            .from('meg_entities')
            .update({
              status: 'merged',
              merged_into_id: targetId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sourceId)
            .select()
            .single();
          if (error) return errorResponse(error.message, 400);
          return jsonResponse(data);
        } else if (action === 'archive') {
          // ARCHIVE an entity
          const entityId = body.id;
          if (!entityId) return errorResponse('id required in body', 400);

          const { data, error } = await client
            .from('meg_entities')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('id', entityId)
            .select()
            .single();
          if (error) return errorResponse(error.message, 400);
          return jsonResponse(data);
        } else {
          // CREATE entity
          const { data, error } = await client
            .from('meg_entities')
            .insert([body])
            .select()
            .single();
          if (error) return errorResponse(error.message, 400);
          return jsonResponse(data, 201);
        }
      } else if (req.method === 'PATCH') {
        // UPDATE entity — only allowlisted fields may be changed
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;
        const body = await req.json();
        const entityId = body.id;
        if (!entityId) return errorResponse('id required in body', 400);

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.canonical_name !== undefined) patch.canonical_name = body.canonical_name;
        if (body.entity_type !== undefined) patch.entity_type = body.entity_type;
        if (body.status !== undefined) patch.status = body.status;
        if (body.external_ids !== undefined) patch.external_ids = body.external_ids;
        if (body.attributes !== undefined) patch.attributes = body.attributes;
        if (body.metadata !== undefined) patch.metadata = body.metadata;

        const { data, error } = await client
          .from('meg_entities')
          .update(patch)
          .eq('id', entityId)
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      } else {
        return errorResponse('Method not allowed', 405);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
