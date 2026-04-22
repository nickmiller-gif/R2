import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody, type FieldSpec } from '../_shared/validate.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    const idParam = last && last !== 'eigen-policy-rules' ? last : null;

    const serviceClient = supabaseClients.service();

    if (req.method === 'GET') {
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;

      if (idParam) {
        const { data, error } = await serviceClient
          .from('eigen_policy_rules')
          .select('*')
          .eq('id', idParam)
          .single();
        if (error) return errorResponse(error.message, 404);
        return jsonResponse(data);
      }

      const policyTag = url.searchParams.get('policy_tag');
      const effect = url.searchParams.get('effect');

      let query = serviceClient.from('eigen_policy_rules').select('*').order('created_at', { ascending: false });
      if (policyTag) query = query.eq('policy_tag', policyTag);
      if (effect) query = query.eq('effect', effect);

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data ?? []);
    }

    const roleCheck = await requireRole(auth.claims.userId, 'operator');
    if (!roleCheck.ok) return roleCheck.response;

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

      const insertRow: Record<string, unknown> = {
        policy_tag: body.data.policy_tag,
        capability_tag_pattern: body.data.capability_tag_pattern,
        effect: body.data.effect,
        required_role: body.data.required_role ?? null,
        rationale: body.data.rationale ?? null,
        metadata: body.data.metadata ?? {},
      };

      const { data, error } = await serviceClient
        .from('eigen_policy_rules')
        .insert([insertRow])
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
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
      if (obj.policy_tag !== undefined) {
        if (typeof obj.policy_tag !== 'string') return errorResponse('policy_tag must be a string', 400);
        patch.policy_tag = obj.policy_tag;
      }
      if (obj.capability_tag_pattern !== undefined) {
        if (typeof obj.capability_tag_pattern !== 'string') {
          return errorResponse('capability_tag_pattern must be a string', 400);
        }
        patch.capability_tag_pattern = obj.capability_tag_pattern;
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
        patch.required_role = obj.required_role;
      }
      if (obj.rationale !== undefined) {
        if (obj.rationale !== null && typeof obj.rationale !== 'string') {
          return errorResponse('rationale must be a string or null', 400);
        }
        patch.rationale = obj.rationale;
      }
      if (obj.metadata !== undefined) {
        if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
          return errorResponse('metadata must be a JSON object', 400);
        }
        patch.metadata = obj.metadata;
      }
      patch.updated_at = new Date().toISOString();

      const updatableKeys = Object.keys(patch).filter((k) => k !== 'updated_at');
      if (updatableKeys.length === 0) {
        return errorResponse('No updatable fields in body', 400);
      }

      const { data, error } = await serviceClient
        .from('eigen_policy_rules')
        .update(patch)
        .eq('id', ruleId)
        .select()
        .single();
      if (error) return errorResponse(error.message, 400);
      return jsonResponse(data);
    }

    return errorResponse('Method not allowed', 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
