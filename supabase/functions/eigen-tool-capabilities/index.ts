import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClientFactory } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';
import { resolveEigenCapabilityAccess } from '../_shared/eigen-policy-engine.ts';
import { resolveEigenxPolicyScope } from '../_shared/eigen-policy-access.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import {
  clampExplicitEigenxPolicyScope,
  defaultEigenxRetrievePolicyScope,
  readEigenxEnvDefaultPolicyScope,
} from '../_shared/eigenx-scope.ts';

// Columns the client may populate on CREATE / UPDATE. `id`, `created_at`,
// `updated_at` are DB-controlled (uuid default + now()). Passing the raw
// request body to `.insert([body])` / `.update(body)` on a `service_role`
// client would let an operator override `id` (bypassing the UUID default)
// or backdate `created_at` / `updated_at`.
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

// Mirrors the `tool_mode` / `approval_policy` Postgres enums — validated here
// so malformed input surfaces as a clean 400 instead of a raw PG error string.
const TOOL_MODE_VALUES = new Set(['read', 'write']);
const APPROVAL_POLICY_VALUES = new Set(['none_required', 'user_approval', 'admin_approval']);

const supabaseClients = createSupabaseClientFactory();

// Explicit `tool_capabilities` projection — the KOS capability-filter paths
// below read `capability_tags` and `io_schema_ref` off every row, so a future
// internal column addition must not leak automatically via `select('*')`.
const TOOL_CAPABILITIES_SELECT_COLUMNS =
  'approval_policy,blast_radius,capability_tags,connector_dependencies,created_at,fallback_mode,id,io_schema_ref,mode,name,role_requirements,tool_id,updated_at';

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
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readCapabilityTags(row: unknown): string[] {
  if (!row || typeof row !== 'object') return [];
  const tags = (row as { capability_tags?: unknown }).capability_tags;
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag).trim()).filter(Boolean);
}

Deno.serve(
  withRequestMeta(async (req) => {
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
        const preScope =
          requestedScope.length > 0
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
            .select(TOOL_CAPABILITIES_SELECT_COLUMNS)
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
          if (!allowed)
            return errorResponse('Capability not available for current policy scope', 404);

          return jsonResponse(data);
        } else {
          const toolId = url.searchParams.get('tool_id');
          const mode = url.searchParams.get('mode');
          const approvalPolicy = url.searchParams.get('approval_policy');

          let query = serviceClient
            .from('tool_capabilities')
            .select(TOOL_CAPABILITIES_SELECT_COLUMNS);

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
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;
        const rawBody = await req.json();
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
          return errorResponse('Request body must be a JSON object', 400);
        }
        const insertRow = sanitizeInsert(
          rawBody as Record<string, unknown>,
          TOOL_CAPABILITY_WRITABLE_FIELDS,
          {},
        );
        if (typeof insertRow.tool_id !== 'string' || insertRow.tool_id.trim().length === 0) {
          return errorResponse('tool_id is required', 400);
        }
        if (typeof insertRow.name !== 'string' || insertRow.name.trim().length === 0) {
          return errorResponse('name is required', 400);
        }
        if (typeof insertRow.mode !== 'string' || !TOOL_MODE_VALUES.has(insertRow.mode)) {
          return errorResponse("mode must be 'read' or 'write'", 400);
        }
        if (
          insertRow.approval_policy !== undefined &&
          (typeof insertRow.approval_policy !== 'string' ||
            !APPROVAL_POLICY_VALUES.has(insertRow.approval_policy))
        ) {
          return errorResponse(
            "approval_policy must be one of 'none_required', 'user_approval', 'admin_approval'",
            400,
          );
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
        const roleCheck = await requireRole(auth.claims.userId, 'operator');
        if (!roleCheck.ok) return roleCheck.response;
        const idemError = requireIdempotencyKey(req);
        if (idemError) return idemError;
        const rawBody = await req.json();
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
          return errorResponse('Request body must be a JSON object', 400);
        }
        const body = rawBody as Record<string, unknown>;
        const id = typeof body.id === 'string' ? body.id : null;

        if (!id) {
          return errorResponse('id required in body', 400);
        }

        const updateRow = sanitizeUpdate(body, TOOL_CAPABILITY_WRITABLE_FIELDS);
        if (typeof updateRow.mode === 'string' && !TOOL_MODE_VALUES.has(updateRow.mode)) {
          return errorResponse("mode must be 'read' or 'write'", 400);
        }
        if (
          typeof updateRow.approval_policy === 'string' &&
          !APPROVAL_POLICY_VALUES.has(updateRow.approval_policy)
        ) {
          return errorResponse(
            "approval_policy must be one of 'none_required', 'user_approval', 'admin_approval'",
            400,
          );
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
  }),
);
