import { corsHeaders, corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { resolveEigenCapabilityAccess } from '../_shared/eigen-policy-engine.ts';
import { resolveEigenxPolicyScope } from '../_shared/eigen-policy-access.ts';
import {
  clampExplicitEigenxPolicyScope,
  defaultEigenxRetrievePolicyScope,
  readEigenxEnvDefaultPolicyScope,
} from '../_shared/eigenx-scope.ts';

const supabaseClients = createSupabaseClientFactory();

function parseScopeParam(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to comma parsing.
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
}

function readCapabilityTags(row: unknown): string[] {
  if (!row || typeof row !== 'object') return [];
  const tags = (row as { capability_tags?: unknown }).capability_tags;
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag).trim()).filter(Boolean);
}

const TOOL_CAPABILITY_WRITABLE_FIELDS = [
  'tool_id',
  'name',
  'capability_tags',
  'io_schema_ref',
  'mode',
  'approval_policy',
  'role_requirements',
  'connector_dependencies',
  'blast_radius',
  'fallback_mode',
] as const;

type JsonObjectParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: Response };

async function parseJsonObject(req: Request): Promise<JsonObjectParseResult> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return { ok: false, response: errorResponse('Invalid JSON body', 400) };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: errorResponse('Request body must be a JSON object', 400) };
  }
  return { ok: true, data: parsed as Record<string, unknown> };
}

function pickToolCapabilityFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TOOL_CAPABILITY_WRITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const capId = url.searchParams.get('id');
    const serviceClient = supabaseClients.service();

    if (req.method === 'GET') {
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;

      const requestedScope = parseScopeParam(url.searchParams.get('policy_scope'));
      const preScope = requestedScope.length > 0
        ? clampExplicitEigenxPolicyScope(auth.claims.userId, roleCheck.roles, requestedScope)
        : defaultEigenxRetrievePolicyScope(auth.claims.userId, roleCheck.roles);
      const resolvedScope = await resolveEigenxPolicyScope(serviceClient, {
        userId: auth.claims.userId,
        requestedPolicyScope: preScope,
        defaultPolicyScope: readEigenxEnvDefaultPolicyScope(),
      });
      if (resolvedScope.grantsConfigured && resolvedScope.effectivePolicyScope.length === 0) {
        return errorResponse('No private policy scope access for this user', 403);
      }

      if (capId) {
        const { data, error } = await serviceClient
          .from('tool_capabilities')
          .select('*')
          .eq('id', capId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        const capabilityTags = readCapabilityTags(data);
        if (capabilityTags.length === 0) return jsonResponse(data);

        const access = await resolveEigenCapabilityAccess(serviceClient, {
          policyTags: resolvedScope.effectivePolicyScope,
          capabilityTags,
          callerRoles: roleCheck.roles,
        });
        if (!access.rulesConfigured) return jsonResponse(data);
        const allowed = capabilityTags.some((tag) => access.allowedCapabilityTags.includes(tag));
        if (!allowed) return errorResponse('Capability not available for current policy scope', 404);

        return jsonResponse(data);
      } else {
        const toolId = url.searchParams.get('tool_id');
        const mode = url.searchParams.get('mode');
        const approvalPolicy = url.searchParams.get('approval_policy');

        let query = serviceClient.from('tool_capabilities').select('*');

        if (toolId) query = query.eq('tool_id', toolId);
        if (mode) query = query.eq('mode', mode);
        if (approvalPolicy) query = query.eq('approval_policy', approvalPolicy);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        const rows = data ?? [];
        const requestedCapabilityTags = Array.from(
          new Set(rows.flatMap((row: unknown) => readCapabilityTags(row))),
        );
        if (requestedCapabilityTags.length === 0) return jsonResponse(rows);

        const access = await resolveEigenCapabilityAccess(serviceClient, {
          policyTags: resolvedScope.effectivePolicyScope,
          capabilityTags: requestedCapabilityTags,
          callerRoles: roleCheck.roles,
        });
        if (!access.rulesConfigured) return jsonResponse(rows);
        const allowedSet = new Set(access.allowedCapabilityTags);
        const filtered = rows.filter((row: unknown) => {
          const tags = readCapabilityTags(row);
          return tags.length === 0 || tags.some((tag) => allowedSet.has(tag));
        });
        return jsonResponse(filtered);
      }
    } else if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const parsed = await parseJsonObject(req);
      if (!parsed.ok) return parsed.response;
      const insertRow = pickToolCapabilityFields(parsed.data);
      if (typeof insertRow.tool_id !== 'string' || insertRow.tool_id.trim().length === 0) {
        return errorResponse('tool_id is required', 400);
      }
      if (typeof insertRow.name !== 'string' || insertRow.name.trim().length === 0) {
        return errorResponse('name is required', 400);
      }
      if (typeof insertRow.mode !== 'string' || (insertRow.mode !== 'read' && insertRow.mode !== 'write')) {
        return errorResponse("mode must be 'read' or 'write'", 400);
      }

      const { data, error } = await serviceClient
        .from('tool_capabilities')
        .insert([insertRow])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      const roleCheck = await requireRole(auth.claims.userId, 'operator'); if (!roleCheck.ok) return roleCheck.response;
      const idemError = requireIdempotencyKey(req); if (idemError) return idemError;
      const parsed = await parseJsonObject(req);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const id = typeof body.id === 'string' ? body.id : null;

      if (!id) {
        return errorResponse('id required in body', 400);
      }

      const updateRow = pickToolCapabilityFields(body);
      if (typeof updateRow.mode === 'string' && updateRow.mode !== 'read' && updateRow.mode !== 'write') {
        return errorResponse("mode must be 'read' or 'write'", 400);
      }
      if (Object.keys(updateRow).length === 0) {
        return errorResponse('No updatable fields in body', 400);
      }

      const { data, error } = await serviceClient
        .from('tool_capabilities')
        .update(updateRow)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
