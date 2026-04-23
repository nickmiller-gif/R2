import { corsHeaders, corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { fetchSourceInventory } from '../_shared/source-inventory.ts';
import { enforceEigenPublicRateLimit } from '../_shared/public-rate-limit.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

    try {
      const client = getServiceClient();
      const rate = await enforceEigenPublicRateLimit(client, req);
      if (!rate.ok) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retry_after_sec: rate.retryAfterSec }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': String(rate.retryAfterSec),
            },
          },
        );
      }

      const data = await fetchSourceInventory(client, 'public');
      return jsonResponse(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
