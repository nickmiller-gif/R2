import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody, type FieldSpec } from '../_shared/validate.ts';
import { ROLE_HIERARCHY, type CharterRole } from '../_shared/roles.ts';
import { extractRequestMeta, withRequestMeta } from '../_shared/correlation.ts';
import { logError } from '../_shared/log.ts';
import { insertEigenPolicyRuleHistoryEvent } from '../_shared/eigen-policy-rule-audit.ts';

const supabaseClients = createSupabaseClientFactory();

// Explicit projection for the public-read rule list including the new
// versioning columns (slice 4) so operators can see which rule is the
// current active version + where the supersede chain leads.
const POLICY_RULES_SELECT_COLUMNS =
  'capability_tag_pattern,created_at,effect,id,is_active,metadata,policy_tag,rationale,required_role,superseded_by,updated_at,version';

const POLICY_RULE_HISTORY_SELECT_COLUMNS =
  'action,actor_id,after_state,before_state,correlation_id,id,metadata,occurred_at,rationale,rule_id';

const CREATE_FIELDS: FieldSpec[] = [
  { name: 'policy_tag', type: 'string' },
  { name: 'capability_tag_pattern', type: 'string' },
  { name: 'effect', type: 'string' },
  { name: 'required_role', type: 'string', required: false },
  { name: 'rationale', type: 'string', required: false },
  { name: 'metadata', type: 'object', required: false },
];

const EFFECTS = new Set(['allow', 'deny']);

function isCharterRole(value: string): value is CharterRole {
  return (ROLE_HIERARCHY as readonly string[]).includes(value);
}

function snapshotRule(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    policy_tag: row.policy_tag,
    capability_tag_pattern: row.capability_tag_pattern,
    effect: row.effect,
    required_role: row.required_role ?? null,
    rationale: row.rationale ?? null,
    metadata: row.metadata ?? {},
    version: row.version ?? 1,
    is_active: row.is_active ?? true,
    superseded_by: row.superseded_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const meta = extractRequestMeta(req);

    try {
      const url = new URL(req.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      const idParam = last && last !== 'eigen-policy-rules' ? last : null;
      const scope = url.searchParams.get('scope') ?? 'active';

      if (req.method === 'GET') {
        const roleCheck = await requireRole(auth.claims.userId, 'member');
        if (!roleCheck.ok) return roleCheck.response;
        const userClient = supabaseClients.user(req);

        // Operator-only surfaces (history / all-versions list) require
        // operator-class roles. Member-level readers see only the current
        // active rule set.
        if (scope === 'history' || scope === 'rule_history') {
          const operatorCheck = await requireRole(auth.claims.userId, 'operator');
          if (!operatorCheck.ok) return operatorCheck.response;

          let historyQuery = userClient
            .from('eigen_policy_rule_history')
            .select(POLICY_RULE_HISTORY_SELECT_COLUMNS)
            .order('occurred_at', { ascending: false });

          if (idParam) {
            historyQuery = historyQuery.eq('rule_id', idParam);
          }
          const historyRuleIdFilter = url.searchParams.get('rule_id');
          if (historyRuleIdFilter) {
            historyQuery = historyQuery.eq('rule_id', historyRuleIdFilter);
          }
          const actionFilter = url.searchParams.get('action');
          if (actionFilter) {
            historyQuery = historyQuery.eq('action', actionFilter);
          }

          const { data, error } = await historyQuery;
          if (error) return errorResponse(error.message, 400);
          return jsonResponse(data ?? []);
        }

        if (idParam) {
          const { data, error } = await userClient
            .from('eigen_policy_rules')
            .select(POLICY_RULES_SELECT_COLUMNS)
            .eq('id', idParam)
            .single();
          if (error) return errorResponse(error.message, 404);
          return jsonResponse(data);
        }

        const policyTag = url.searchParams.get('policy_tag');
        const effect = url.searchParams.get('effect');

        let query = userClient
          .from('eigen_policy_rules')
          .select(POLICY_RULES_SELECT_COLUMNS)
          .order('policy_tag', { ascending: true })
          .order('capability_tag_pattern', { ascending: true })
          .order('version', { ascending: false });

        // Default scope is `active` — only the latest active version per
        // rule lineage. `scope=all` exposes the full history table's rule
        // rows (including superseded ones) for operator backfills.
        if (scope === 'active') {
          query = query.eq('is_active', true);
        } else if (scope !== 'all') {
          return errorResponse(
            `Unsupported scope: ${scope}. Allowed: active, all, history, rule_history.`,
            400,
          );
        }

        if (policyTag) query = query.eq('policy_tag', policyTag);
        if (effect) query = query.eq('effect', effect);

        const { data, error } = await query;
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data ?? []);
      }

      const roleCheck = await requireRole(auth.claims.userId, 'operator');
      if (!roleCheck.ok) return roleCheck.response;
      const serviceClient = supabaseClients.service();

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      if (req.method === 'POST') {
        const body = await validateBody<{
          policy_tag: string;
          capability_tag_pattern: string;
          effect: string;
          required_role?: string | null;
          rationale?: string | null;
          metadata?: Record<string, unknown>;
        }>(req, CREATE_FIELDS);
        if (!body.ok) return body.response;

        if (!EFFECTS.has(body.data.effect)) {
          return errorResponse('effect must be allow or deny', 400);
        }
        if (
          body.data.required_role !== undefined &&
          body.data.required_role !== null &&
          !isCharterRole(body.data.required_role)
        ) {
          return errorResponse(`required_role must be one of: ${ROLE_HIERARCHY.join(', ')}`, 400);
        }
        if (
          body.data.metadata !== undefined &&
          (typeof body.data.metadata !== 'object' ||
            body.data.metadata === null ||
            Array.isArray(body.data.metadata))
        ) {
          return errorResponse('metadata must be a JSON object', 400);
        }

        const insertRow: Record<string, unknown> = {
          policy_tag: body.data.policy_tag,
          capability_tag_pattern: body.data.capability_tag_pattern,
          effect: body.data.effect,
          required_role: body.data.required_role ?? null,
          rationale: body.data.rationale ?? null,
          metadata: body.data.metadata ?? {},
          version: 1,
          is_active: true,
        };

        const { data, error } = await serviceClient
          .from('eigen_policy_rules')
          .insert([insertRow])
          .select()
          .single();
        if (error) return errorResponse(error.message, 400);

        const auditWarnings: string[] = [];
        const auditError = await insertEigenPolicyRuleHistoryEvent(serviceClient, {
          ruleId: data.id as string,
          action: 'create',
          beforeState: null,
          afterState: snapshotRule(data as Record<string, unknown>),
          actorId: auth.claims.userId,
          correlationId: meta.correlationId,
          rationale: body.data.rationale ?? null,
          metadata: { surface: 'eigen-policy-rules', http_method: 'POST' },
        });
        if (auditError) {
          logError('eigen-policy-rules create audit failed', {
            functionName: 'eigen-policy-rules',
            ruleId: data.id,
            error: auditError,
            correlationId: meta.correlationId,
          });
          auditWarnings.push(`create:${auditError}`);
        }

        const responseBody =
          auditWarnings.length > 0 && data && typeof data === 'object'
            ? { ...(data as Record<string, unknown>), auditWarnings }
            : data;
        return jsonResponse(responseBody, 201);
      }

      if (req.method === 'PATCH') {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return errorResponse('Invalid JSON body', 400);
        }
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return errorResponse('Request body must be a JSON object', 400);
        }
        const obj = body as Record<string, unknown>;
        const ruleId = idParam ?? (typeof obj.id === 'string' ? obj.id : null);
        if (!ruleId) {
          return errorResponse('id required in path or body', 400);
        }

        // Load the predecessor first so we can snapshot it into history and
        // validate it's still the active version.
        const { data: predecessor, error: predecessorErr } = await serviceClient
          .from('eigen_policy_rules')
          .select('*')
          .eq('id', ruleId)
          .single();
        if (predecessorErr || !predecessor) {
          return errorResponse(predecessorErr?.message ?? 'Rule not found', 404);
        }
        if (predecessor.is_active === false) {
          return errorResponse(
            'Cannot supersede an already-inactive rule; start from its active successor',
            409,
          );
        }

        // Build the successor row by copying predecessor fields and layering
        // the allowlisted patches. Narrow to exactly the PATCH-able surface so
        // the client can't smuggle version / is_active / superseded_by / id.
        const next: Record<string, unknown> = {
          policy_tag: predecessor.policy_tag,
          capability_tag_pattern: predecessor.capability_tag_pattern,
          effect: predecessor.effect,
          required_role: predecessor.required_role ?? null,
          rationale: predecessor.rationale ?? null,
          metadata: predecessor.metadata ?? {},
          version: (predecessor.version ?? 1) + 1,
          is_active: true,
        };

        if (obj.policy_tag !== undefined) {
          if (typeof obj.policy_tag !== 'string') {
            return errorResponse('policy_tag must be a string', 400);
          }
          next.policy_tag = obj.policy_tag;
        }
        if (obj.capability_tag_pattern !== undefined) {
          if (typeof obj.capability_tag_pattern !== 'string') {
            return errorResponse('capability_tag_pattern must be a string', 400);
          }
          next.capability_tag_pattern = obj.capability_tag_pattern;
        }
        if (obj.effect !== undefined) {
          if (typeof obj.effect !== 'string' || !EFFECTS.has(obj.effect)) {
            return errorResponse('effect must be allow or deny', 400);
          }
          next.effect = obj.effect;
        }
        if (obj.required_role !== undefined) {
          if (obj.required_role !== null && typeof obj.required_role !== 'string') {
            return errorResponse('required_role must be a string or null', 400);
          }
          if (typeof obj.required_role === 'string' && !isCharterRole(obj.required_role)) {
            return errorResponse(`required_role must be one of: ${ROLE_HIERARCHY.join(', ')}`, 400);
          }
          next.required_role = obj.required_role;
        }
        if (obj.rationale !== undefined) {
          if (obj.rationale !== null && typeof obj.rationale !== 'string') {
            return errorResponse('rationale must be a string or null', 400);
          }
          next.rationale = obj.rationale;
        }
        if (obj.metadata !== undefined) {
          if (
            typeof obj.metadata !== 'object' ||
            obj.metadata === null ||
            Array.isArray(obj.metadata)
          ) {
            return errorResponse('metadata must be a JSON object', 400);
          }
          next.metadata = obj.metadata;
        }

        // Versioned supersede: insert the new row, then mark the predecessor
        // inactive and point it at the new id. The partial unique index on
        // active rows means we must flip predecessor's is_active *before* the
        // new row acquires the index slot — do it in that order.
        const { data: inserted, error: insertErr } = await serviceClient
          .from('eigen_policy_rules')
          .insert([next])
          .select()
          .single();
        if (insertErr || !inserted) {
          return errorResponse(insertErr?.message ?? 'Failed to insert superseding rule', 400);
        }
        const newId = inserted.id as string;

        // Now retire the predecessor. If this fails we have a duplicate
        // active rule (both predecessor and successor) — flag loudly.
        const { data: supersededPredecessor, error: supersedeErr } = await serviceClient
          .from('eigen_policy_rules')
          .update({
            is_active: false,
            superseded_by: newId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ruleId)
          .select()
          .single();
        if (supersedeErr || !supersededPredecessor) {
          logError('eigen-policy-rules supersede predecessor flip failed', {
            functionName: 'eigen-policy-rules',
            predecessorId: ruleId,
            newId,
            error: supersedeErr?.message,
            correlationId: meta.correlationId,
          });
          return errorResponse(
            `Superseding rule created (${newId}) but predecessor flip failed: ${
              supersedeErr?.message ?? 'unknown'
            }`,
            500,
          );
        }

        const auditWarnings: string[] = [];
        const notes =
          typeof obj.notes === 'string'
            ? obj.notes
            : typeof obj.rationale === 'string'
              ? (obj.rationale as string)
              : null;

        const supersedeAudit = await insertEigenPolicyRuleHistoryEvent(serviceClient, {
          ruleId,
          action: 'supersede',
          beforeState: snapshotRule(predecessor as Record<string, unknown>),
          afterState: snapshotRule(supersededPredecessor as Record<string, unknown>),
          actorId: auth.claims.userId,
          correlationId: meta.correlationId,
          rationale: notes,
          metadata: {
            surface: 'eigen-policy-rules',
            http_method: 'PATCH',
            successor_rule_id: newId,
          },
        });
        if (supersedeAudit) {
          logError('eigen-policy-rules supersede audit failed', {
            functionName: 'eigen-policy-rules',
            predecessorId: ruleId,
            newId,
            error: supersedeAudit,
            correlationId: meta.correlationId,
          });
          auditWarnings.push(`supersede:${supersedeAudit}`);
        }

        const createAudit = await insertEigenPolicyRuleHistoryEvent(serviceClient, {
          ruleId: newId,
          action: 'create',
          beforeState: null,
          afterState: snapshotRule(inserted as Record<string, unknown>),
          actorId: auth.claims.userId,
          correlationId: meta.correlationId,
          rationale: notes,
          metadata: {
            surface: 'eigen-policy-rules',
            http_method: 'PATCH',
            predecessor_rule_id: ruleId,
          },
        });
        if (createAudit) {
          logError('eigen-policy-rules successor create audit failed', {
            functionName: 'eigen-policy-rules',
            predecessorId: ruleId,
            newId,
            error: createAudit,
            correlationId: meta.correlationId,
          });
          auditWarnings.push(`create_successor:${createAudit}`);
        }

        const responseBody =
          auditWarnings.length > 0 && inserted && typeof inserted === 'object'
            ? { ...(inserted as Record<string, unknown>), auditWarnings }
            : inserted;
        return jsonResponse(responseBody, 201);
      }

      if (req.method === 'DELETE') {
        const ruleId = idParam ?? url.searchParams.get('id');
        if (!ruleId) {
          return errorResponse('id required in path or query', 400);
        }

        const { data: predecessor, error: predecessorErr } = await serviceClient
          .from('eigen_policy_rules')
          .select('*')
          .eq('id', ruleId)
          .single();
        if (predecessorErr || !predecessor) {
          return errorResponse(predecessorErr?.message ?? 'Rule not found', 404);
        }
        if (predecessor.is_active === false) {
          return jsonResponse({ retracted: false, reason: 'already_inactive', id: ruleId });
        }

        const { data: retracted, error: retractErr } = await serviceClient
          .from('eigen_policy_rules')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', ruleId)
          .select()
          .single();
        if (retractErr || !retracted) {
          return errorResponse(retractErr?.message ?? 'Retract failed', 500);
        }

        const auditWarnings: string[] = [];
        const auditError = await insertEigenPolicyRuleHistoryEvent(serviceClient, {
          ruleId,
          action: 'retract',
          beforeState: snapshotRule(predecessor as Record<string, unknown>),
          afterState: snapshotRule(retracted as Record<string, unknown>),
          actorId: auth.claims.userId,
          correlationId: meta.correlationId,
          rationale: url.searchParams.get('notes'),
          metadata: { surface: 'eigen-policy-rules', http_method: 'DELETE' },
        });
        if (auditError) {
          logError('eigen-policy-rules retract audit failed', {
            functionName: 'eigen-policy-rules',
            ruleId,
            error: auditError,
            correlationId: meta.correlationId,
          });
          auditWarnings.push(`retract:${auditError}`);
        }

        return jsonResponse(
          auditWarnings.length > 0
            ? { retracted: true, id: ruleId, auditWarnings }
            : { retracted: true, id: ruleId },
        );
      }

      return errorResponse('Method not allowed', 405);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
