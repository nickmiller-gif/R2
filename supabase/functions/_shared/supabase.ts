import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `${name} environment variable is not set. Edge functions cannot operate without it.`,
    );
  }
  return value;
}

export function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: authHeader ?? '' } },
    },
  );
}

export function getServiceClient() {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
}
