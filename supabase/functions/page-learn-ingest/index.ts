import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  return jsonResponse(
    {
      ok: true,
      status: 'accepted',
      mode: 'compatibility_noop',
      message:
        'Legacy page-learn-ingest endpoint acknowledged. Use autonomous-capture-ingest for authenticated capture writes.',
      accepted_at: new Date().toISOString(),
    },
    202,
  );
});
