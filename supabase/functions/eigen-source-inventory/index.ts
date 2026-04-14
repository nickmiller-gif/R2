import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { fetchSourceInventory } from '../_shared/source-inventory.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;
  const roleCheck = await requireRole(auth.claims.userId, 'member');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const data = await fetchSourceInventory(getServiceClient(), 'all');
    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
