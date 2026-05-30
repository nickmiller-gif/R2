import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

export const SUPABASE_URL =
  extra?.supabaseUrl?.trim() || 'https://zudslxucibosjwefojtm.supabase.co';

export const SUPABASE_ANON_KEY = extra?.supabaseAnonKey?.trim() ?? '';

export const API_BASE = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1`;

export const APP_SOURCE_SYSTEM_LABELS: Record<string, string> = {
  centralr2: 'CentralR2',
  'centralr2-core': 'CentralR2',
  'operator-workbench': 'R2Works',
  'continuity-nexus': 'R2Chart',
  'ip-pulse-point': 'R2-IP',
  oracle: 'Oracle',
  charter: 'Charter',
  manual: 'Uploads',
  'manual-upload': 'Uploads',
};

export function labelForSourceSystem(sourceSystem: string): string {
  const key = sourceSystem.toLowerCase();
  return APP_SOURCE_SYSTEM_LABELS[key] ?? sourceSystem;
}
