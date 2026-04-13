import { createClient } from '@supabase/supabase-js';

type SupabaseClientCreateFn = typeof createClient;

export interface SupabaseClientFactory {
  user(authHeader?: string): ReturnType<SupabaseClientCreateFn>;
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
  const url = options.url ?? process.env.SUPABASE_URL ?? '';
  const anonKey = options.anonKey ?? process.env.SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  return {
    user(authHeader = '') {
      return clientCreate(url, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
    },
    service() {
      return clientCreate(url, serviceRoleKey);
    },
  };
}
