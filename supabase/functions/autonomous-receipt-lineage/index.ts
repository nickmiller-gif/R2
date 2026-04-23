import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;
    const roleCheck = await requireRole(auth.claims.userId, 'member');
    if (!roleCheck.ok) return roleCheck.response;

    const url = new URL(req.url);
    const retrievalRunId = url.searchParams.get('retrieval_run_id');

    if (!retrievalRunId) {
      return jsonResponse({
        status: 'receipt_unavailable',
        retrieval_run_id: null,
        lineage: null,
        receipt_missing: true,
      });
    }

    const client = getServiceClient();
    const { data, error } = await client
      .from('retrieval_runs')
      .select('id,status,metadata,created_at')
      .eq('id', retrievalRunId)
      .maybeSingle();

    if (error) return errorResponse(error.message, 400);
    if (!data) {
      return jsonResponse({
        status: 'lineage_not_found',
        retrieval_run_id: retrievalRunId,
        lineage: null,
        reconciliation_queued: true,
      });
    }

    const metadata =
      data.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {};
    const ingestRun =
      metadata.ingest_run && typeof metadata.ingest_run === 'object'
        ? (metadata.ingest_run as Record<string, unknown>)
        : {};
    const sourceEntityType =
      typeof metadata.source_entity_type === 'string' ? metadata.source_entity_type : null;
    const sourceEntityId =
      typeof metadata.source_entity_id === 'string' ? metadata.source_entity_id : null;
    const ingestRunId = typeof ingestRun.id === 'string' ? ingestRun.id : null;
    const ingestTrigger = typeof ingestRun.trigger === 'string' ? ingestRun.trigger : null;
    const ingestSourceSystem =
      typeof ingestRun.source_system === 'string' ? ingestRun.source_system : null;
    const ingestStartedAt = typeof ingestRun.started_at === 'string' ? ingestRun.started_at : null;
    const evidenceTier = typeof metadata.evidence_tier === 'string' ? metadata.evidence_tier : null;
    const sourcesQueriedRaw = metadata.sources_queried;
    const sourcesQueried = Array.isArray(sourcesQueriedRaw)
      ? sourcesQueriedRaw.filter((v) => typeof v === 'string')
      : [];
    const replayIdempotencyKey =
      typeof metadata.replay_idempotency_key === 'string' ? metadata.replay_idempotency_key : null;
    const metadataRetrievalRunId =
      typeof metadata.retrieval_run_id === 'string' ? metadata.retrieval_run_id : null;

    return jsonResponse({
      status: 'resolved',
      retrieval_run_id: retrievalRunId,
      retrieval_run: {
        id: data.id,
        status: data.status,
        created_at: data.created_at,
      },
      lineage: {
        source_entity_type: sourceEntityType,
        source_entity_id: sourceEntityId,
        ingest_run: {
          id: ingestRunId,
          trigger: ingestTrigger,
          source_system: ingestSourceSystem,
          started_at: ingestStartedAt,
        },
        evidence_tier: evidenceTier,
        sources_queried: sourcesQueried,
        replay_idempotency_key: replayIdempotencyKey,
        retrieval_run_id: metadataRetrievalRunId ?? retrievalRunId,
      },
    });
  }),
);
