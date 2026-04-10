import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseClientCreateFn = typeof createClient;

export interface SupabaseClientFactory {
  user(req: Request): ReturnType<SupabaseClientCreateFn>;
  service(): ReturnType<SupabaseClientCreateFn>;
}

export interface SupabaseClientFactoryOptions {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  createClientImpl?: SupabaseClientCreateFn;
}

export function createSupabaseClientFactory(
  options: SupabaseClientFactoryOptions = {},
): SupabaseClientFactory {
  const clientCreate = options.createClientImpl ?? createClient;
  const url = options.url ?? Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = options.anonKey ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = options.serviceRoleKey ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  return {
    user(req: Request) {
      const authHeader = req.headers.get('Authorization');
      return clientCreate(url, anonKey, {
        global: { headers: { Authorization: authHeader ?? '' } },
      });
    },
    service() {
      return clientCreate(url, serviceRoleKey);
    },
  };
}

const defaultSupabaseClientFactory = createSupabaseClientFactory();

export function getSupabaseClient(req: Request) {
  return defaultSupabaseClientFactory.user(req);
}

export function getServiceClient() {
  return defaultSupabaseClientFactory.service();
}
