import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody, type FieldSpec } from '../_shared/validate.ts';
import { ROLE_HIERARCHY, type CharterRole } from '../_shared/roles.ts';
import {
  insertEigenPolicyRuleEvent,
  type EigenPolicyRuleSnapshot,
} from '../_shared/eigen-policy-engine.ts';
import {
  EigenPolicyRuleValidationError,
  normalizePolicyRuleInput,
  normalizePolicyRulePatch,
} from '../../../src/lib/eigen/eigen-policy-eval.ts';

const supabaseClients = createSupabaseClientFactory();

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

function validationErrorResponse(err: unknown): Response {
  if (err instanceof EigenPolicyRuleValidationError) {
    return errorResponse(err.message, 400);
  }
  throw err;
}

async function writeAuditEvent(
  client: ReturnType<typeof supabaseClients.service>,
  params: {
    ruleId: string;
    eventType: 'created' | 'updated';
    actorId: string;
    beforeSnapshot: EigenPolicyRuleSnapshot | null;
    afterSnapshot: EigenPolicyRuleSnapshot;
  },
): Promise<void> {
  const auditError = await insertEigenPolicyRuleEvent(client, params);
  if (auditError) {
    // Log but do not fail the mutation — the primary write already committed.
    console.error('[eigen-policy-rules] audit event insert failed', {
      ruleId: params.ruleId,
      eventType: params.eventType,
      error: auditError,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    const idParam = last && last !== 'eigen-policy-rules' ? last : null;

    if (req.method === 'GET') {
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;
      const userClient = supabaseClients.user(req);

      if (idParam) {
        const { data, error } = await userClient
          .from('eigen_policy_rules')
          .select('*')
          .eq('id', idParam)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      }

      const policyTag = url.searchParams.get('policy_tag');
      const effect = url.searchParams.get('effect');

      let query = userClient.from('eigen_policy_rules').select('*').order('created_at', { ascending: false });
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
      if (body.data.required_role !== undefined && body.data.required_role !== null && !isCharterRole(body.data.required_role)) {
        return errorResponse(`required_role must be one of: ${ROLE_HIERARCHY.join(', ')}`, 400);
      }

      let normalized;
      try {
        normalized = normalizePolicyRuleInput({
          policyTag: body.data.policy_tag,
          capabilityTagPattern: body.data.capability_tag_pattern,
          rationale: body.data.rationale ?? null,
          metadata: body.data.metadata ?? {},
        });
      } catch (err) {
        return validationErrorResponse(err);
      }

      const insertRow: Record<string, unknown> = {
        policy_tag: normalized.policyTag,
        capability_tag_pattern: normalized.capabilityTagPattern,
        effect: body.data.effect,
        required_role: body.data.required_role ?? null,
        rationale: normalized.rationale,
        metadata: normalized.metadata,
      };

      const { data, error } = await serviceClient
        .from('eigen_policy_rules')
        .insert([insertRow])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);

      const created = data as EigenPolicyRuleSnapshot;
      await writeAuditEvent(serviceClient, {
        ruleId: created.id,
        eventType: 'created',
        actorId: auth.claims.userId,
        beforeSnapshot: null,
        afterSnapshot: created,
      });
      return jsonResponse(data, 201);
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
      const ruleId =
        idParam ??
        (typeof obj.id === 'string' ? obj.id : null);
      if (!ruleId) {
        return errorResponse('id required in path or body', 400);
      }

      const patch: Record<string, unknown> = {};
      let normalized: ReturnType<typeof normalizePolicyRulePatch>;
      try {
        normalized = normalizePolicyRulePatch({
          policyTag: obj.policy_tag as string | undefined,
          capabilityTagPattern: obj.capability_tag_pattern as string | undefined,
          rationale: obj.rationale as string | null | undefined,
          metadata: obj.metadata as Record<string, unknown> | null | undefined,
        });
      } catch (err) {
        return validationErrorResponse(err);
      }

      if (normalized.policyTag !== undefined) patch.policy_tag = normalized.policyTag;
      if (normalized.capabilityTagPattern !== undefined) {
        patch.capability_tag_pattern = normalized.capabilityTagPattern;
      }
      if (obj.effect !== undefined) {
        if (typeof obj.effect !== 'string' || !EFFECTS.has(obj.effect)) {
          return errorResponse('effect must be allow or deny', 400);
        }
        patch.effect = obj.effect;
      }
      if (obj.required_role !== undefined) {
        if (obj.required_role !== null && typeof obj.required_role !== 'string') {
          return errorResponse('required_role must be a string or null', 400);
        }
        if (typeof obj.required_role === 'string' && !isCharterRole(obj.required_role)) {
          return errorResponse(`required_role must be one of: ${ROLE_HIERARCHY.join(', ')}`, 400);
        }
        patch.required_role = obj.required_role;
      }
      if (obj.rationale !== undefined) {
        patch.rationale = normalized.rationale ?? null;
      }
      if (obj.metadata !== undefined) {
        patch.metadata = normalized.metadata ?? {};
      }

      const updatableKeys = Object.keys(patch);
      if (updatableKeys.length === 0) {
        return errorResponse('No updatable fields in body', 400);
      }
      patch.updated_at = new Date().toISOString();

      const { data: beforeData, error: beforeError } = await serviceClient
        .from('eigen_policy_rules')
        .select('*')
        .eq('id', ruleId)
        .maybeSingle();
      if (beforeError) return errorResponse(beforeError.message, 400);
      if (!beforeData) return errorResponse('Rule not found', 404);

      const { data, error } = await serviceClient
        .from('eigen_policy_rules')
        .update(patch)
        .eq('id', ruleId)
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);

      const after = data as EigenPolicyRuleSnapshot;
      await writeAuditEvent(serviceClient, {
        ruleId: after.id,
        eventType: 'updated',
        actorId: auth.claims.userId,
        beforeSnapshot: beforeData as EigenPolicyRuleSnapshot,
        afterSnapshot: after,
      });
      return jsonResponse(data);
    }

    return errorResponse('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
