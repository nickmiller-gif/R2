import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { fetchSourceInventory } from '../_shared/source-inventory.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const data = await fetchSourceInventory(getServiceClient(), 'public');
    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
