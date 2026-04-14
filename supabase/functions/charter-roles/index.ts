import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { requireIdempotencyKey, validateBody, type FieldSpec } from '../_shared/validate.ts';

const CREATE_FIELDS: FieldSpec[] = [
  { name: 'user_id', type: 'string' },
  { name: 'role', type: 'string' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  // 1. Authenticate — verify JWT signature + extract identity
  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const id = pathname.split('/').pop() === 'charter-roles' ? null : pathname.split('/').pop();

    if (req.method === 'GET') {
      // Reads use the caller's token context (RLS applies)
      const client = getSupabaseClient(req);

      if (id) {
        const { data, error } = await client
          .from('charter_user_roles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        const userId = url.searchParams.get('user_id');
        const role = url.searchParams.get('role');

        let query = client.from('charter_user_roles').select('*');
        if (userId) query = query.eq('user_id', userId);
        if (role) query = query.eq('role', role);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    }

    // --- Mutations below: require admin role + idempotency key ---

    // 2. Authorize — role assignments require admin
    const roleCheck = await requireRole(auth.claims.userId, 'admin');
    if (!roleCheck.ok) return roleCheck.response;

    // 3. Require idempotency key
    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;

    const client = getServiceClient();

    if (req.method === 'POST') {
      // 4. Validate request body
      const body = await validateBody<{
        user_id: string;
        role: string;
      }>(req, CREATE_FIELDS);
      if (!body.ok) return body.response;

      const { data, error } = await client
        .from('charter_user_roles')
        .insert([{ ...body.data, assigned_by: auth.claims.userId }])
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data, 201);
    } else if (req.method === 'PATCH') {
      const body = await validateBody<{ id: string; role: string }>(req, [
        { name: 'id', type: 'string' },
        { name: 'role', type: 'string' },
      ]);
      if (!body.ok) return body.response;

      const { id, ...updates } = body.data;

      const { data, error } = await client
        .from('charter_user_roles')
        .update(updates)
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
