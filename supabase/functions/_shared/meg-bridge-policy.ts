/**
 * Pure policy helpers for `meg-resolve-bridge` (Eigen external MEG resolve).
 *
 * The bridge runs with gateway `verify_jwt = false`, so every defense lives in
 * code. These helpers encapsulate the request-time policy decisions so they
 * can be unit-tested without spinning up Deno.serve, mirroring the
 * `signal-utils.ts` / `tryServiceRoleAuth` pattern used by `r2-signal-ingest`
 * (see ADR-0003 / ADR-005).
 *
 * Hardening goals captured here:
 * - Refuse to authorize if the configured bridge token is missing or
 *   suspiciously short (catches placeholder secrets in production).
 * - Optional source-platform allowlist so a leaked token cannot mint MEG
 *   entities under arbitrary `p_source_system` slugs.
 * - Opt-out gate for the documented `hints.meg_canonical_id` /
 *   `hints.canonical_external_id` override, since that field, if abused,
 *   lets a token holder attach their `(source_platform, external_id)` to
 *   an existing canonical entity (spine-poisoning vector).
 * - Structured requester fingerprint (ip, user-agent) for audit logs on
 *   both success and unauthorized paths.
 */

/**
 * Minimum acceptable length for `MEG_RESOLVE_BRIDGE_TOKEN`. Tokens shorter
 * than this are treated as misconfigured (placeholder / sample values) and
 * the bridge fails closed with 503. Keep aligned with the runbook guidance
 * `openssl rand -hex 32` (64 hex chars).
 */
export const MIN_BRIDGE_TOKEN_LEN = 32;

/** Result of validating the *configured* `MEG_RESOLVE_BRIDGE_TOKEN` secret. */
export type BridgeTokenStatus = 'ok' | 'missing' | 'weak';

export function validateBridgeToken(configured: string | undefined | null): BridgeTokenStatus {
  const trimmed = (configured ?? '').trim();
  if (!trimmed) return 'missing';
  if (trimmed.length < MIN_BRIDGE_TOKEN_LEN) return 'weak';
  return 'ok';
}

/**
 * Parses a comma-separated allowlist from env. Returns `null` when unset
 * (allow-all, back-compat). Returns a normalised array otherwise: trimmed,
 * lowercased, deduped, empty entries dropped.
 */
export function parseAllowedSources(raw: string | undefined | null): readonly string[] | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const set = new Set<string>();
  for (const part of trimmed.split(',')) {
    const value = part.trim().toLowerCase();
    if (value) set.add(value);
  }
  return set.size === 0 ? null : Array.from(set);
}

export function isSourcePlatformAllowed(
  sourcePlatform: string,
  allowed: readonly string[] | null,
): boolean {
  if (allowed === null) return true;
  return allowed.includes(sourcePlatform.toLowerCase());
}

/**
 * Whether caller-supplied `hints.meg_canonical_id` / `hints.canonical_external_id`
 * is honored. Default `true` preserves the published contract; operators flip
 * to `false` once they have confirmed no caller depends on the override.
 *
 * Recognised falsy values: `false`, `0`, `no`, `off` (case-insensitive).
 * Everything else (including unset) → `true`.
 */
export function isCanonicalOverrideAllowed(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null) return true;
  const v = raw.trim().toLowerCase();
  if (!v) return true;
  return !(v === 'false' || v === '0' || v === 'no' || v === 'off');
}

function firstHeaderValue(headers: Headers, key: string): string | null {
  const raw = headers.get(key);
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim() ?? '';
  return first.length > 0 ? first : null;
}

export interface RequesterFingerprint {
  ip: string;
  userAgent: string;
}

export function getRequesterFingerprint(req: Request): RequesterFingerprint {
  const ip =
    firstHeaderValue(req.headers, 'cf-connecting-ip') ??
    firstHeaderValue(req.headers, 'x-real-ip') ??
    firstHeaderValue(req.headers, 'x-forwarded-for') ??
    'unknown-ip';
  const userAgent = req.headers.get('user-agent') ?? 'unknown-ua';
  return { ip, userAgent: userAgent.slice(0, 256) };
}

/**
 * Pure decision logic for the bridge `Content-Type` check. The bridge only
 * ever consumes JSON bodies, but historical callers may omit the header on
 * server-to-server `fetch`. Accept absent / empty / `application/json`
 * (with optional `; charset=…`); reject anything else.
 */
export function isAcceptableContentType(header: string | null | undefined): boolean {
  if (!header) return true;
  const v = header.trim().toLowerCase();
  if (!v) return true;
  const mediaType = v.split(';')[0]?.trim() ?? '';
  return mediaType === 'application/json';
}
