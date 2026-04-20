import {
  reflectedCorsResponse,
  reflectedErrorResponse,
  reflectedJsonResponse,
} from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { createWidgetSessionToken, type WidgetMode } from '../_shared/widget-session.ts';
import { POLICY_TAG_EIGEN_PUBLIC, POLICY_TAG_EIGENX } from '../_shared/eigen-policy.ts';
import { resolveEffectiveEigenxScope } from '../_shared/eigenx-scope-resolver.ts';
import { assertNoClientPolicyScopeOverride } from '../_shared/policy-scope-guard.ts';

interface WidgetSessionRequest {
  site_id: string;
  mode?: WidgetMode;
}

interface RegistryConfig {
  site_id: string;
  mode: 'public' | 'eigenx' | 'mixed';
  origins: string[];
  source_systems: string[];
  default_policy_scope: string[];
  status: string;
}

function parseRequest(value: unknown): WidgetSessionRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  assertNoClientPolicyScopeOverride(value);
  const body = value as Record<string, unknown>;
  if (typeof body.site_id !== 'string' || body.site_id.trim().length === 0) {
    throw new Error('site_id is required');
  }
  return {
    site_id: body.site_id.trim(),
    mode: body.mode === 'eigenx' ? 'eigenx' : 'public',
  };
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '').toLowerCase();
}

function parseSiteMapEnv(): Record<string, RegistryConfig> {
  const raw = Deno.env.get('EIGEN_WIDGET_SITE_MAP')?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, RegistryConfig> = {};
    for (const [siteId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      out[siteId] = {
        site_id: siteId,
        mode: v.mode === 'eigenx' || v.mode === 'mixed' ? v.mode : 'public',
        origins: Array.isArray(v.origins) ? v.origins.map((o) => normalizeOrigin(String(o))) : [],
        source_systems: Array.isArray(v.source_systems) ? v.source_systems.map((s) => String(s)) : [],
        default_policy_scope: Array.isArray(v.default_policy_scope)
          ? v.default_policy_scope.map((s) => String(s))
          : [],
        status: typeof v.status === 'string' ? v.status : 'active',
      };
    }
    return out;
  } catch {
    return {};
  }
}

async function loadRegistryConfig(
  siteId: string,
): Promise<RegistryConfig | null> {
  const envMap = parseSiteMapEnv();
  if (envMap[siteId]) return envMap[siteId];

  const client = getServiceClient();
  const query = await client
    .from('eigen_site_registry')
    .select('site_id,mode,origins,source_systems,default_policy_scope,status')
    .eq('site_id', siteId)
    .maybeSingle();

  if (query.error) return null;
  if (!query.data) return null;
  const row = query.data as Record<string, unknown>;
  return {
    site_id: String(row.site_id),
    mode: row.mode === 'eigenx' || row.mode === 'mixed' ? row.mode : 'public',
    origins: Array.isArray(row.origins)
      ? row.origins.map((o) => normalizeOrigin(String(o)))
      : [],
    source_systems: Array.isArray(row.source_systems)
      ? row.source_systems.map((s) => String(s))
      : [],
    default_policy_scope: Array.isArray(row.default_policy_scope)
      ? row.default_policy_scope.map((s) => String(s))
      : [],
    status: typeof row.status === 'string' ? row.status : 'active',
  };
}

Deno.serve(async (req) => {
  const rawOrigin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return reflectedCorsResponse(rawOrigin);
  if (req.method !== 'POST') return reflectedErrorResponse(rawOrigin, 'Method not allowed', 405);

  try {
    const body = parseRequest(await req.json());
    if (!rawOrigin) return reflectedErrorResponse(rawOrigin, 'Missing Origin header', 400);
    const origin = normalizeOrigin(rawOrigin);

    const config = await loadRegistryConfig(body.site_id);
    if (!config) return reflectedErrorResponse(rawOrigin, `Unknown site_id: ${body.site_id}`, 404);
    if (config.status !== 'active') return reflectedErrorResponse(rawOrigin, 'Site is not active', 403);
    if (!config.origins.includes(origin)) {
      return reflectedErrorResponse(rawOrigin, 'Origin not allowed for site', 403);
    }

    const requestedMode: WidgetMode = body.mode ?? 'public';
    if (requestedMode === 'eigenx') {
      if (config.mode === 'public') {
        return reflectedErrorResponse(rawOrigin, 'Site is configured for public mode only', 403);
      }
      const auth = await guardAuth(req);
      if (!auth.ok) return auth.response;
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;

      const scopeResolution = await resolveEffectiveEigenxScope({
        client: getServiceClient(),
        userId: auth.claims.userId,
        roles: roleCheck.roles,
      });
      if (scopeResolution.emptyAfterGrantIntersection) {
        return reflectedErrorResponse(rawOrigin, 'No private policy scope access for this user', 403);
      }
      const scope = scopeResolution.effectivePolicyScope;

      const issued = await createWidgetSessionToken({
        site_id: body.site_id,
        mode: 'eigenx',
        origin,
        site_source_systems: config.source_systems,
        default_policy_scope: scope,
        user_id: auth.claims.userId,
      });
      return reflectedJsonResponse(rawOrigin, {
        widget_token: issued.token,
        expires_at: issued.expires_at,
        site_id: body.site_id,
        mode: 'eigenx',
        site_source_systems: config.source_systems,
        default_policy_scope: scope,
        grants_configured: scopeResolution.grantsConfigured,
      });
    }

    // Hard guarantee: a public (unauthenticated) widget session MUST NOT carry
    // the private `eigenx` policy tag. Even if a registry row has `eigenx` in
    // `default_policy_scope` (legacy config, misconfiguration, or a mixed-mode
    // row), we strip it here so the token cannot authorize private retrieval.
    // The only path that grants `eigenx` scope is the authenticated `eigenx`
    // branch above, which performs RBAC + grant intersection.
    const publicScopeFromConfig = config.default_policy_scope.filter(
      (tag) => tag !== POLICY_TAG_EIGENX,
    );
    const publicScope = publicScopeFromConfig.length > 0
      ? publicScopeFromConfig
      : [POLICY_TAG_EIGEN_PUBLIC];

    const issued = await createWidgetSessionToken({
      site_id: body.site_id,
      mode: 'public',
      origin,
      site_source_systems: config.source_systems,
      default_policy_scope: publicScope,
    });
    return reflectedJsonResponse(rawOrigin, {
      widget_token: issued.token,
      expires_at: issued.expires_at,
      site_id: body.site_id,
      mode: 'public',
      site_source_systems: config.source_systems,
      default_policy_scope: publicScope,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return reflectedErrorResponse(rawOrigin, message, 500);
  }
});
