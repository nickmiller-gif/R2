import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody } from '../_shared/validate.ts';

import {
  createOracleWhitespaceCoreService,
  createOracleProfileRunService,
  createOracleServiceLayerService,
  toOracleServiceLayerResultEnvelope,
  type DbOracleWhitespaceCoreRow,
  type DbOracleProfileRunRow,
  type DbOracleServiceLayerRow,
} from '../../../src/services/oracle/index.ts';

import type {
  ExecuteOracleServiceLayerRunInput,
  OracleWhitespaceAnalysisInput,
} from '../../../src/types/oracle/index.ts';

const ORACLE_WHITESPACE_CORE_TABLE = 'oracle_whitespace_core_runs';
const ORACLE_SERVICE_LAYER_TABLE = 'oracle_service_layer_runs';

interface ExecuteWhitespaceRunRequest {
  entityAssetId: string;
  runLabel: string;
  analysisInput: OracleWhitespaceAnalysisInput;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get('id');

    const callerScopedClient = getSupabaseClient(req);
    const serviceClient = getServiceClient();

    const whitespaceCore = createOracleWhitespaceCoreService({
      async insertRun(row: DbOracleWhitespaceCoreRow) {
        const { data, error } = await serviceClient
          .from(ORACLE_WHITESPACE_CORE_TABLE)
          .insert([row])
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data as DbOracleWhitespaceCoreRow;
      },
      async findRunById(id: string) {
        const { data, error } = await callerScopedClient
          .from(ORACLE_WHITESPACE_CORE_TABLE)
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as DbOracleWhitespaceCoreRow | null) ?? null;
      },
    });

    const profileRun = createOracleProfileRunService({
      async insertRun(row: DbOracleProfileRunRow) {
        const { data, error } = await serviceClient
          .from('oracle_profile_runs')
          .insert([row])
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data as DbOracleProfileRunRow;
      },
      async findRunById(id: string) {
        const { data, error } = await serviceClient
          .from('oracle_profile_runs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as DbOracleProfileRunRow | null) ?? null;
      },
      async findLatestForEntity(entityAssetId: string) {
        const { data, error } = await serviceClient
          .from('oracle_profile_runs')
          .select('*')
          .eq('entity_asset_id', entityAssetId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as DbOracleProfileRunRow | null) ?? null;
      },
      async queryRuns() {
        throw new Error('queryRuns not implemented for oracle-whitespace-runs edge function');
      },
      async updateRun(id: string, patch: Partial<DbOracleProfileRunRow>) {
        const { data, error } = await serviceClient
          .from('oracle_profile_runs')
          .update(patch)
          .eq('id', id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data as DbOracleProfileRunRow;
      },
    });

    const serviceLayer = createOracleServiceLayerService(
      {
        async insertRun(row: DbOracleServiceLayerRow) {
          const { data, error } = await serviceClient
            .from(ORACLE_SERVICE_LAYER_TABLE)
            .insert([row])
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data as DbOracleServiceLayerRow;
        },
        async findRunById(id: string) {
          const { data, error } = await callerScopedClient
            .from(ORACLE_SERVICE_LAYER_TABLE)
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (error) throw new Error(error.message);
          return (data as DbOracleServiceLayerRow | null) ?? null;
        },
        async updateRun(id: string, patch: Partial<DbOracleServiceLayerRow>) {
          const { data, error } = await serviceClient
            .from(ORACLE_SERVICE_LAYER_TABLE)
            .update(patch)
            .eq('id', id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return data as DbOracleServiceLayerRow;
        },
      },
      {
        whitespaceCore,
        profileRun,
      },
    );

    if (req.method === 'GET') {
      if (!runId) {
        return errorResponse('id query parameter is required', 400);
      }

      const run = await serviceLayer.getRunById(runId);
      if (!run) return errorResponse('Oracle service-layer run not found', 404);

      return jsonResponse({
        run,
        result: toOracleServiceLayerResultEnvelope(run),
      });
    }

    if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const body = await validateBody<ExecuteWhitespaceRunRequest>(req, [
        { name: 'entityAssetId', type: 'string' },
        { name: 'runLabel', type: 'string' },
        { name: 'analysisInput', type: 'object' },
        { name: 'metadata', type: 'object', required: false },
      ]);
      if (!body.ok) return body.response;

      const input: ExecuteOracleServiceLayerRunInput = {
        entityAssetId: body.data.entityAssetId,
        runLabel: body.data.runLabel,
        triggeredBy: auth.claims.userId,
        analysisInput: body.data.analysisInput,
        metadata: body.data.metadata,
      };

      const run = await serviceLayer.executeWhitespaceRun(input);

      return jsonResponse(
        {
          run,
          result: toOracleServiceLayerResultEnvelope(run),
        },
        201,
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
