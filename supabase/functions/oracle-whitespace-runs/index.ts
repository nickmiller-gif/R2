import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody } from '../_shared/validate.ts';

import {
  createOracleWhitespaceCoreService,
  type DbOracleWhitespaceCoreRow,
} from '../../../src/services/oracle/oracle-whitespace-core.service.ts';
import {
  createOracleProfileRunService,
  type DbOracleProfileRunRow,
} from '../../../src/services/oracle/oracle-profile-run.service.ts';
import {
  createOracleServiceLayerService,
  type DbOracleServiceLayerRow,
} from '../../../src/services/oracle/oracle-service-layer.service.ts';
import {
  createOracleServiceLayerRunDecisionService,
  type DbOracleServiceLayerRunDecisionRow,
} from '../../../src/services/oracle/oracle-service-layer-decision.service.ts';
import {
  createOracleServiceLayerRunOutcomeService,
  type DbOracleServiceLayerRunOutcomeRow,
} from '../../../src/services/oracle/oracle-service-layer-run-outcome.service.ts';
import { toOracleServiceLayerResultEnvelope } from '../../../src/services/oracle/oracle-service-layer-api.service.ts';

interface OracleWhitespaceAnalysisInput {
  [key: string]: unknown;
}

interface ExecuteOracleServiceLayerRunInput {
  entityAssetId: string;
  runLabel: string;
  triggeredBy: string;
  analysisInput: OracleWhitespaceAnalysisInput;
  metadata?: Record<string, unknown>;
}

const ORACLE_WHITESPACE_CORE_TABLE = 'oracle_whitespace_core_runs';
const ORACLE_SERVICE_LAYER_TABLE = 'oracle_service_layer_runs';
const ORACLE_SERVICE_LAYER_RUN_DECISION_TABLE = 'oracle_service_layer_run_decisions';
const ORACLE_SERVICE_LAYER_RUN_OUTCOME_TABLE = 'oracle_service_layer_run_outcomes';

interface ExecuteWhitespaceRunRequest {
  entityAssetId: string;
  runLabel: string;
  analysisInput: OracleWhitespaceAnalysisInput;
  metadata?: Record<string, unknown>;
}

interface UpsertOperatorDecisionRequest {
  decisionStatus: 'pursue' | 'defer' | 'dismiss';
  notes?: string;
}

interface UpsertRunOutcomeRequest {
  outcomeStatus: 'pursued' | 'deferred' | 'dismissed' | 'won' | 'lost';
  outcomeNotes?: string;
  outcomeRevenue?: number;
  outcomeClosedAt?: string;
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

    const decisionService = createOracleServiceLayerRunDecisionService({
      async upsertDecision(row: DbOracleServiceLayerRunDecisionRow) {
        const { data, error } = await serviceClient
          .from(ORACLE_SERVICE_LAYER_RUN_DECISION_TABLE)
          .upsert([row], { onConflict: 'oracle_service_layer_run_id' })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data as DbOracleServiceLayerRunDecisionRow;
      },
      async findDecisionByRunId(oracleServiceLayerRunId: string) {
        const { data, error } = await callerScopedClient
          .from(ORACLE_SERVICE_LAYER_RUN_DECISION_TABLE)
          .select('*')
          .eq('oracle_service_layer_run_id', oracleServiceLayerRunId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as DbOracleServiceLayerRunDecisionRow | null) ?? null;
      },
    });

    const runOutcomeService = createOracleServiceLayerRunOutcomeService({
      async upsertOutcome(row: DbOracleServiceLayerRunOutcomeRow) {
        const { data, error } = await serviceClient
          .from(ORACLE_SERVICE_LAYER_RUN_OUTCOME_TABLE)
          .upsert([row], { onConflict: 'oracle_service_layer_run_id' })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data as DbOracleServiceLayerRunOutcomeRow;
      },
      async findOutcomeByRunId(oracleServiceLayerRunId: string) {
        const { data, error } = await callerScopedClient
          .from(ORACLE_SERVICE_LAYER_RUN_OUTCOME_TABLE)
          .select('*')
          .eq('oracle_service_layer_run_id', oracleServiceLayerRunId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as DbOracleServiceLayerRunOutcomeRow | null) ?? null;
      },
      async findOutcomeById(id: string) {
        const { data, error } = await callerScopedClient
          .from(ORACLE_SERVICE_LAYER_RUN_OUTCOME_TABLE)
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as DbOracleServiceLayerRunOutcomeRow | null) ?? null;
      },
      async queryOutcomes() {
        throw new Error('queryOutcomes not implemented for oracle-whitespace-runs edge function');
      },
      async updateOutcome(id: string, patch: Partial<DbOracleServiceLayerRunOutcomeRow>) {
        const { data, error } = await serviceClient
          .from(ORACLE_SERVICE_LAYER_RUN_OUTCOME_TABLE)
          .update(patch)
          .eq('id', id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data as DbOracleServiceLayerRunOutcomeRow;
      },
    });

    if (req.method === 'GET') {
      if (!runId) {
        return errorResponse('id query parameter is required', 400);
      }

      const run = await serviceLayer.getRunById(runId);
      if (!run) return errorResponse('Oracle service-layer run not found', 404);
      const operatorDecision = await decisionService.getDecisionByRunId(runId);
      const runOutcome = await runOutcomeService.getOutcomeByRunId(runId);

      return jsonResponse({
        run,
        result: toOracleServiceLayerResultEnvelope(run),
        operatorDecision,
        runOutcome,
      });
    }

    if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      if (!runId) {
        return errorResponse('id query parameter is required', 400);
      }

      const run = await serviceLayer.getRunById(runId);
      if (!run) return errorResponse('Oracle service-layer run not found', 404);

      const body = await validateBody<UpsertOperatorDecisionRequest>(req, [
        { name: 'decisionStatus', type: 'string' },
        { name: 'notes', type: 'string', required: false },
      ]);
      if (!body.ok) return body.response;

      if (!['pursue', 'defer', 'dismiss'].includes(body.data.decisionStatus)) {
        return errorResponse('decisionStatus must be pursue, defer, or dismiss', 400);
      }

      const decision = await decisionService.upsertDecision({
        oracleServiceLayerRunId: runId,
        decisionStatus: body.data.decisionStatus,
        notes: body.data.notes ?? null,
        decidedBy: auth.claims.userId,
      });

      return jsonResponse({ decision });
    }

    if (req.method === 'PUT') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      if (!runId) {
        return errorResponse('id query parameter is required', 400);
      }

      const run = await serviceLayer.getRunById(runId);
      if (!run) return errorResponse('Oracle service-layer run not found', 404);

      const body = await validateBody<UpsertRunOutcomeRequest>(req, [
        { name: 'outcomeStatus', type: 'string' },
        { name: 'outcomeNotes', type: 'string', required: false },
        { name: 'outcomeRevenue', type: 'number', required: false },
        { name: 'outcomeClosedAt', type: 'string', required: false },
      ]);
      if (!body.ok) return body.response;

      if (!['pursued', 'deferred', 'dismissed', 'won', 'lost'].includes(body.data.outcomeStatus)) {
        return errorResponse('outcomeStatus must be pursued, deferred, dismissed, won, or lost', 400);
      }

      const outcome = await runOutcomeService.upsertOutcome({
        oracleServiceLayerRunId: runId,
        outcomeStatus: body.data.outcomeStatus,
        outcomeNotes: body.data.outcomeNotes ?? null,
        outcomeRevenue: body.data.outcomeRevenue ?? null,
        outcomeClosedAt: body.data.outcomeClosedAt ?? null,
        recordedBy: auth.claims.userId,
      });

      return jsonResponse({ outcome });
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

      if (
        body.data.analysisInput === null ||
        typeof body.data.analysisInput !== 'object' ||
        Array.isArray(body.data.analysisInput)
      ) {
        return errorResponse('analysisInput must be a non-array object', 400);
      }

      if (
        body.data.metadata !== undefined &&
        (body.data.metadata === null ||
          typeof body.data.metadata !== 'object' ||
          Array.isArray(body.data.metadata))
      ) {
        return errorResponse('metadata must be a non-array object', 400);
      }

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
