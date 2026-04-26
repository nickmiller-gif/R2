export function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function signHmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return hexEncode(signature);
}

export function normalizeSignalSignature(value: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('sha256=')) return trimmed.slice('sha256='.length).toLowerCase();
  return trimmed.toLowerCase();
}

export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < maxLen; i += 1) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

export type ServiceRoleAuthResult =
  | { mode: 'service_role' }
  | { mode: 'reject'; reason: string }
  | null;

/**
 * Pure decision logic for the service-role auth bypass
 * (ADR-005-service-role-ingest-bypass). Extracted from the handler so
 * it can be unit-tested without Deno.env coupling.
 */
export function tryServiceRoleAuth(
  bearer: string | null,
  serviceRoleKey: string | undefined,
  hmacConfigured: boolean,
): ServiceRoleAuthResult {
  if (!bearer || !serviceRoleKey) return null;
  if (!timingSafeEqual(bearer, serviceRoleKey)) return null;

  if (!hmacConfigured) {
    return {
      mode: 'reject',
      reason: 'Service-role auth requires R2_SIGNAL_INGEST_HMAC_SECRET to be configured',
    };
  }
  return { mode: 'service_role' };
}

export async function verifySignalHmac(
  secret: string,
  body: string,
  inboundHeader: string | null,
): Promise<boolean> {
  const inboundSig = normalizeSignalSignature(inboundHeader);
  if (!inboundSig) return false;
  const expectedSig = await signHmacSha256(secret, body);
  return timingSafeEqual(inboundSig, expectedSig);
}

export function buildSourceSignalKey(sourceSystem: string, idempotencyKey: string): string {
  return `${sourceSystem}:${idempotencyKey}`;
}

export function inferSignalPolicyTags(
  sourceSystem: string,
  privacyLevel: 'public' | 'members' | 'operator' | 'private',
  routingTargets: string[],
): string[] {
  const tags = ['signal_contract_v1', `source_${sourceSystem}`];
  tags.push(privacyLevel === 'public' ? 'eigen_public' : 'eigenx');
  if (routingTargets.includes('oracle')) tags.push('oracle_candidate');
  return tags;
}

export function computeNextRetryAt(now: Date = new Date(), delayMs = 5 * 60 * 1000): string {
  return new Date(now.getTime() + delayMs).toISOString();
}
