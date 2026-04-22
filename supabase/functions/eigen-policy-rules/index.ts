import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody, type FieldSpec } from '../_shared/validate.ts';
import { ROLE_HIERARCHY, type CharterRole } from '../_shared/roles.ts';

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

// Input bounds — keep in sync with the matching DB CHECK constraints in
// supabase/migrations/202604250001_eigen_policy_rules_input_bounds.sql.
// Rules are loaded on the hot path of every Eigen request, so unbounded
// strings or pathological wildcard patterns are a cross-surface concern.
const MAX_POLICY_TAG_LEN = 128;
const MAX_CAPABILITY_PATTERN_LEN = 128;
const MAX_RATIONALE_LEN = 2000;
const MAX_POLICY_TAG_WILDCARDS = 4;
const MAX_CAPABILITY_PATTERN_WILDCARDS = 8;
const MAX_METADATA_BYTES = 8192;

function isCharterRole(value: string): value is CharterRole {
  return (ROLE_HIERARCHY as readonly string[]).includes(value);
}

function countWildcards(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i++) if (value[i] === '*') n++;
  return n;
}

function validatePolicyTag(value: unknown): string | null {
  if (typeof value !== 'string') return 'policy_tag must be a string';
  if (value.trim().length === 0) return 'policy_tag must not be empty';
  if (value.length > MAX_POLICY_TAG_LEN) {
    return `policy_tag exceeds ${MAX_POLICY_TAG_LEN} characters`;
  }
  if (countWildcards(value) > MAX_POLICY_TAG_WILDCARDS) {
    return `policy_tag has more than ${MAX_POLICY_TAG_WILDCARDS} wildcards`;
  }
  return null;
}

function validateCapabilityTagPattern(value: unknown): string | null {
  if (typeof value !== 'string') return 'capability_tag_pattern must be a string';
  if (value.trim().length === 0) return 'capability_tag_pattern must not be empty';
  if (value.length > MAX_CAPABILITY_PATTERN_LEN) {
    return `capability_tag_pattern exceeds ${MAX_CAPABILITY_PATTERN_LEN} characters`;
  }
  if (countWildcards(value) > MAX_CAPABILITY_PATTERN_WILDCARDS) {
    return `capability_tag_pattern has more than ${MAX_CAPABILITY_PATTERN_WILDCARDS} wildcards`;
  }
  return null;
}

function validateRationale(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return 'rationale must be a string or null';
  if (value.length > MAX_RATIONALE_LEN) {
    return `rationale exceeds ${MAX_RATIONALE_LEN} characters`;
  }
  return null;
}

function validateMetadata(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return 'metadata must be a JSON object';
  }
  // JSON.stringify byte-ish bound; prevents a single rule from being loaded
  // into memory as an outsized payload on every evaluation.
  const size = new TextEncoder().encode(JSON.stringify(value)).length;
  if (size > MAX_METADATA_BYTES) {
    return `metadata exceeds ${MAX_METADATA_BYTES} bytes when serialized`;
  }
  return null;
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

      const policyTagError = validatePolicyTag(body.data.policy_tag);
      if (policyTagError) return errorResponse(policyTagError, 400);
      const patternError = validateCapabilityTagPattern(body.data.capability_tag_pattern);
      if (patternError) return errorResponse(patternError, 400);
      if (!EFFECTS.has(body.data.effect)) {
        return errorResponse('effect must be allow or deny', 400);
      }
      if (body.data.required_role !== undefined && body.data.required_role !== null && !isCharterRole(body.data.required_role)) {
        return errorResponse(`required_role must be one of: ${ROLE_HIERARCHY.join(', ')}`, 400);
      }
      const rationaleError = validateRationale(body.data.rationale);
      if (rationaleError) return errorResponse(rationaleError, 400);
      const metadataError = validateMetadata(body.data.metadata);
      if (metadataError) return errorResponse(metadataError, 400);

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
        const err = validatePolicyTag(obj.policy_tag);
        if (err) return errorResponse(err, 400);
        patch.policy_tag = obj.policy_tag;
      }
      if (obj.capability_tag_pattern !== undefined) {
        const err = validateCapabilityTagPattern(obj.capability_tag_pattern);
        if (err) return errorResponse(err, 400);
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
        if (typeof obj.required_role === 'string' && !isCharterRole(obj.required_role)) {
          return errorResponse(`required_role must be one of: ${ROLE_HIERARCHY.join(', ')}`, 400);
        }
        patch.required_role = obj.required_role;
      }
      if (obj.rationale !== undefined) {
        const err = validateRationale(obj.rationale);
        if (err) return errorResponse(err, 400);
        patch.rationale = obj.rationale;
      }
      if (obj.metadata !== undefined) {
        const err = validateMetadata(obj.metadata);
        if (err) return errorResponse(err, 400);
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
