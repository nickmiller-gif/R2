/**
 * Resolve Eigen autonomous-bot bearer for CLI smokes.
 * Prefers dedicated service tokens; falls back to SUPABASE_SERVICE_ROLE_KEY for local dev.
 */
export function resolveBotServiceToken(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { token: value, source: name };
  }
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (fallback) {
    return { token: fallback, source: 'SUPABASE_SERVICE_ROLE_KEY' };
  }
  return null;
}

export function requireBotServiceToken(...names) {
  const resolved = resolveBotServiceToken(...names);
  if (!resolved) {
    const label = names.join(' or ');
    console.error(`Set ${label}, or SUPABASE_SERVICE_ROLE_KEY for local smoke.`);
    process.exit(1);
  }
  return resolved;
}
