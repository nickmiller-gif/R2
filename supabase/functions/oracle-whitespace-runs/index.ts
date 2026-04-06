import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody } from '../_shared/validate.ts';

/**
 * Extracts result.summary from the persisted analysis JSON.
 * The merged adapter contract says result.summary comes from
 * analysis.summary (a structured field), NOT from a hardcoded
 * human-readable string. The human-readable message belongs
 * only in oracle_profile_runs.summary.
 */
function extractAnalysisSummary(analysisJson: unknown): string | null {
  if (
    analysisJson &&
    typeof analysisJson === 'object' &&
    'summary' in (analysisJson as Record<string, unknown>)
  ) {
    const summary = (analysisJson as Record<string, unknown>).summary;
    return typeof summary === 'string' ? summary : null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const service = getServiceClient();

    if (req.method === 'GET') {
      const runId = url.searchParams.get('id');
      if (!runId) {
        return errorResponse('Missing required query parameter: id', 400);
      }

      const client = getSupabaseClient(req);

      const { data: slRun, error: slError } = await client
        .from('oracle_service_layer_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (slError || !slRun) {
        return errorResponse('Run not found', 404);
      }

      return jsonResponse({
        run: {
          id: slRun.id,
          entityAssetId: slRun.entity_asset_id,
          runLabel: slRun.run_label,
          triggeredBy: slRun.triggered_by,
          profileRunId: slRun.profile_run_id,
          whitespaceRunId: slRun.whitespace_run_id,
          status: slRun.status,
          errorMessage: slRun.error_message,
          metadata: slRun.metadata,
          createdAt: slRun.created_at,
          updatedAt: slRun.updated_at,
        },
        result: {
          runId: slRun.id,
          status: slRun.status,
          generatedAt: slRun.updated_at,
          summary: extractAnalysisSummary(slRun.analysis_json),
          analysis: slRun.analysis_json ?? null,
        },
      });
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await validateBody(req, [
        { name: 'entityAssetId', type: 'string' },
        { name: 'runLabel', type: 'string' },
        { name: 'analysisInput', type: 'object' },
      ]);
      if (!body.ok) return body.response;

      const { entityAssetId, runLabel, analysisInput, metadata } = body.data as {
        entityAssetId: string;
        runLabel: string;
        analysisInput: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      };

      const now = new Date().toISOString();

      const { data: profileRun, error: profileError } = await service
        .from('oracle_profile_runs')
        .insert({
          entity_asset_id: entityAssetId,
          triggered_by: auth.claims.userId,
          status: 'running',
          started_at: now,
          metadata: metadata ?? {},
        })
        .select()
        .single();

      if (profileError) {
        return errorResponse(`Profile run creation failed: ${profileError.message}`, 500);
      }

      const { data: whitespaceRun, error: wsError } = await service
        .from('oracle_whitespace_core_runs')
        .insert({
          entity_asset_id: entityAssetId,
          run_label: runLabel,
          analysis_json: analysisInput,
        })
        .select()
        .single();

      if (wsError) {
        await service.from('oracle_profile_runs').update({ status: 'failed' }).eq('id', profileRun.id);
        return errorResponse(`Whitespace core run creation failed: ${wsError.message}`, 500);
      }

      const { data: slRun, error: slError } = await service
        .from('oracle_service_layer_runs')
        .insert({
          entity_asset_id: entityAssetId,
          run_label: runLabel,
          triggered_by: auth.claims.userId,
          profile_run_id: profileRun.id,
          whitespace_run_id: whitespaceRun.id,
          status: 'completed',
          analysis_json: analysisInput,
          metadata: metadata ?? {},
        })
        .select()
        .single();

      if (slError) {
        await service.from('oracle_profile_runs').update({ status: 'failed' }).eq('id', profileRun.id);
        return errorResponse(`Service layer run creation failed: ${slError.message}`, 500);
      }

      // Human-readable summary goes ONLY to profile-run completion, not the API envelope
      await service.from('oracle_profile_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        signal_count: 0,
        summary: `Whitespace run '${runLabel}' completed`,
      }).eq('id', profileRun.id);

      return jsonResponse({
        run: {
          id: slRun.id,
          entityAssetId: slRun.entity_asset_id,
          runLabel: slRun.run_label,
          triggeredBy: slRun.triggered_by,
          profileRunId: slRun.profile_run_id,
          whitespaceRunId: slRun.whitespace_run_id,
          status: slRun.status,
          errorMessage: slRun.error_message,
          metadata: slRun.metadata,
          createdAt: slRun.created_at,
          updatedAt: slRun.updated_at,
        },
        result: {
          runId: slRun.id,
          status: slRun.status,
          generatedAt: slRun.updated_at,
          summary: extractAnalysisSummary(slRun.analysis_json),
          analysis: slRun.analysis_json,
        },
      }, 201);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
