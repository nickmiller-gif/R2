import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

type GraphEdgeAggregate = {
  source_entity_id: string;
  target_entity_id: string;
  evidence_chunk_ids: string[];
  evidence_count: number;
};

function buildEdgeKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function edgeFromKey(key: string): [string, string] {
  const [left, right] = key.split('|');
  if (!left || !right) throw new Error(`Invalid edge key: ${key}`);
  return [left, right];
}

function computeEdgeWeight(evidenceCount: number): number {
  return Number(Math.min(1, 0.2 + evidenceCount * 0.15).toFixed(3));
}

async function processPendingJob(): Promise<{
  processed: boolean;
  job_id?: string;
  run_id?: string;
  edges_upserted?: number;
  mentions_scanned?: number;
}> {
  const client = getServiceClient();
  const now = new Date().toISOString();
  const nextJob = await client
    .from('oracle_graph_extraction_jobs')
    .select('id,run_id,status')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextJob.error) throw new Error(nextJob.error.message);
  if (!nextJob.data) return { processed: false };

  const jobId = String(nextJob.data.id);
  const runId = String(nextJob.data.run_id);
  const claim = await client
    .from('oracle_graph_extraction_jobs')
    .update({ status: 'processing', started_at: now, error_message: null })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claim.error) throw new Error(claim.error.message);
  if (!claim.data) return { processed: false };

  try {
    const evidence = await client
      .from('oracle_run_evidence')
      .select('chunk_id')
      .eq('run_id', runId)
      .not('chunk_id', 'is', null);
    if (evidence.error) throw new Error(evidence.error.message);
    const chunkIds = Array.from(
      new Set((evidence.data ?? []).map((row) => String(row.chunk_id)).filter(Boolean)),
    );

    if (chunkIds.length === 0) {
      await client
        .from('oracle_graph_extraction_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: { edge_count: 0, mention_count: 0, reason: 'no_chunk_evidence' },
        })
        .eq('id', jobId);
      return {
        processed: true,
        job_id: jobId,
        run_id: runId,
        edges_upserted: 0,
        mentions_scanned: 0,
      };
    }

    const mentions = await client
      .from('entity_mentions')
      .select('chunk_id,entity_id')
      .in('chunk_id', chunkIds);
    if (mentions.error) throw new Error(mentions.error.message);

    const chunkEntities = new Map<string, Set<string>>();
    for (const mention of mentions.data ?? []) {
      const chunkId = String(mention.chunk_id ?? '');
      const entityId = String(mention.entity_id ?? '');
      if (!chunkId || !entityId) continue;
      if (!chunkEntities.has(chunkId)) chunkEntities.set(chunkId, new Set<string>());
      chunkEntities.get(chunkId)!.add(entityId);
    }

    const aggregateByKey = new Map<string, GraphEdgeAggregate>();
    for (const [chunkId, entitiesSet] of chunkEntities.entries()) {
      const entities = Array.from(entitiesSet);
      if (entities.length < 2) continue;
      for (let i = 0; i < entities.length; i += 1) {
        for (let j = i + 1; j < entities.length; j += 1) {
          const left = entities[i]!;
          const right = entities[j]!;
          if (left === right) continue;
          const key = buildEdgeKey(left, right);
          const existing = aggregateByKey.get(key);
          if (!existing) {
            const [source, target] = edgeFromKey(key);
            aggregateByKey.set(key, {
              source_entity_id: source,
              target_entity_id: target,
              evidence_chunk_ids: [chunkId],
              evidence_count: 1,
            });
          } else {
            existing.evidence_count += 1;
            if (!existing.evidence_chunk_ids.includes(chunkId)) {
              existing.evidence_chunk_ids.push(chunkId);
            }
          }
        }
      }
    }

    const edges = Array.from(aggregateByKey.values());
    if (edges.length > 0) {
      const rows = edges.map((edge) => ({
        source_entity_id: edge.source_entity_id,
        target_entity_id: edge.target_entity_id,
        relation_type: 'related_to',
        weight: computeEdgeWeight(edge.evidence_count),
        evidence_chunk_ids: edge.evidence_chunk_ids,
        evidence_count: edge.evidence_count,
        discovered_in_run_id: runId,
        discovered_by: 'co-occurrence',
        metadata: {
          generated_by: 'oracle-graph-extraction-worker',
          generated_at: new Date().toISOString(),
        },
      }));
      const upsert = await client.from('entity_relations').upsert(rows, {
        onConflict: 'source_entity_id,target_entity_id,relation_type',
      });
      if (upsert.error) throw new Error(upsert.error.message);
    }

    const completeAt = new Date().toISOString();
    const currentRun = await client
      .from('oracle_whitespace_runs')
      .select('stage_progress')
      .eq('id', runId)
      .maybeSingle();
    if (currentRun.error) throw new Error(currentRun.error.message);
    const prevProgress =
      currentRun.data &&
      typeof currentRun.data.stage_progress === 'object' &&
      currentRun.data.stage_progress !== null
        ? (currentRun.data.stage_progress as Record<string, unknown>)
        : {};

    const [jobUpdate, runUpdate] = await Promise.all([
      client
        .from('oracle_graph_extraction_jobs')
        .update({
          status: 'completed',
          completed_at: completeAt,
          metadata: {
            edge_count: edges.length,
            mention_count: (mentions.data ?? []).length,
            chunk_count: chunkIds.length,
          },
        })
        .eq('id', jobId),
      client
        .from('oracle_whitespace_runs')
        .update({
          stage_progress: {
            ...prevProgress,
            graph_extraction_job: 'completed',
            graph_edges_created: edges.length,
            graph_mentions_scanned: (mentions.data ?? []).length,
          },
        })
        .eq('id', runId),
    ]);
    if (jobUpdate.error) throw new Error(jobUpdate.error.message);
    if (runUpdate.error) throw new Error(runUpdate.error.message);

    return {
      processed: true,
      job_id: jobId,
      run_id: runId,
      edges_upserted: edges.length,
      mentions_scanned: (mentions.data ?? []).length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client
      .from('oracle_graph_extraction_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', jobId);
    throw error;
  }
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;
    const roleCheck = await requireRole(auth.claims.userId, 'operator');
    if (!roleCheck.ok) return roleCheck.response;

    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const maxJobs = Math.max(1, Math.min(10, Number(body.max_jobs ?? 1)));
      const processed: Array<Record<string, unknown>> = [];
      for (let i = 0; i < maxJobs; i += 1) {
        const result = await processPendingJob();
        if (!result.processed) break;
        processed.push(result);
      }
      return jsonResponse({ processed_jobs: processed.length, jobs: processed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(message, 500);
    }
  }),
);
