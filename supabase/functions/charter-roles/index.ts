import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { sanitizeInsert, sanitizeUpdate } from '../_shared/sanitize.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

// Columns the client may populate on CREATE. `assigned_by` rides the verified
// JWT (server-injected) so an admin cannot attribute a grant to another admin.
// `id`, `created_at`, `updated_at` are DB-controlled.
const CHARTER_ROLES_INSERT_FIELDS = ['user_id', 'role'] as const;

// Columns the client may populate on UPDATE. `user_id` is intentionally
// excluded — flipping it on an existing row would silently transfer the role
// (including `admin`) to another account, which is a privilege-escalation
// primitive. To grant a role to a different user, POST a new row.
// `assigned_by`, `id`, `created_at` are likewise locked.
const CHARTER_ROLES_UPDATE_FIELDS = ['role'] as const;

// Mirrors the `charter_role` Postgres enum — validated here so malformed
// input surfaces as a clean 400 instead of a raw PG error string.
const CHARTER_ROLE_VALUES = new Set(['member', 'reviewer', 'operator', 'counsel', 'admin']);

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const id = pathname.split('/').pop() === 'charter-roles' ? null : pathname.split('/').pop();

      if (req.method === 'GET') {
        const client = getSupabaseClient(req);

        if (id) {
          const { data, error } = await client
            .from('charter_user_roles')
            .select('assigned_by,created_at,id,role,updated_at,user_id')
            .eq('id', id)
            .single();

          if (error) {
            return errorResponse(error.message, 404);
          }

          return jsonResponse(data);
        } else {
          const userId = url.searchParams.get('user_id');
          const role = url.searchParams.get('role');

          let query = client
            .from('charter_user_roles')
            .select('assigned_by,created_at,id,role,updated_at,user_id');
          if (userId) query = query.eq('user_id', userId);
          if (role) query = query.eq('role', role);

          const { data, error } = await query;

          if (error) {
            return errorResponse(error.message, 400);
          }

          return jsonResponse(data);
        }
      }

      const roleCheck = await requireRole(auth.claims.userId, 'admin');
      if (!roleCheck.ok) return roleCheck.response;

      const idemError = requireIdempotencyKey(req);
      if (idemError) return idemError;

      const client = getServiceClient();

      if (req.method === 'POST') {
        const rawBody = await req.json().catch(() => null);
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
          return errorResponse('Request body must be a JSON object', 400);
        }

        const insertRow = sanitizeInsert(
          rawBody as Record<string, unknown>,
          CHARTER_ROLES_INSERT_FIELDS,
          { assigned_by: auth.claims.userId },
        );

        if (typeof insertRow.user_id !== 'string' || insertRow.user_id.trim().length === 0) {
          return errorResponse('user_id is required', 400);
        }
        if (typeof insertRow.role !== 'string' || !CHARTER_ROLE_VALUES.has(insertRow.role)) {
          return errorResponse(
            "role must be one of 'member', 'reviewer', 'operator', 'counsel', 'admin'",
            400,
          );
        }

        const { data, error } = await client
          .from('charter_user_roles')
          .insert([insertRow])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      } else if (req.method === 'PATCH') {
        const rawBody = await req.json().catch(() => null);
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
          return errorResponse('Request body must be a JSON object', 400);
        }

        const body = rawBody as Record<string, unknown>;
        const targetId = typeof body.id === 'string' ? body.id : null;
        if (!targetId || targetId.trim().length === 0) {
          return errorResponse('id required in body', 400);
        }

        const updateRow = sanitizeUpdate(body, CHARTER_ROLES_UPDATE_FIELDS);

        if (typeof updateRow.role === 'string' && !CHARTER_ROLE_VALUES.has(updateRow.role)) {
          return errorResponse(
            "role must be one of 'member', 'reviewer', 'operator', 'counsel', 'admin'",
            400,
          );
        }

        if (Object.keys(updateRow).length === 0) {
          return errorResponse('No updatable fields in body', 400);
        }

        const { data, error } = await client
          .from('charter_user_roles')
          .update(updateRow)
          .eq('id', targetId)
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
