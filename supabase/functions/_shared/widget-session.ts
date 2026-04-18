export type WidgetMode = 'public' | 'eigenx';

export interface WidgetSessionClaims {
  site_id: string;
  mode: WidgetMode;
  origin: string;
  site_source_systems: string[];
  default_policy_scope: string[];
  grants_configured?: boolean;
  user_id?: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function readWidgetSecret(): string {
  const secret = Deno.env.get('EIGEN_WIDGET_SESSION_SECRET')?.trim();
  if (secret && secret.length >= 16) return secret;
  throw new Error('Missing EIGEN_WIDGET_SESSION_SECRET');
}

function readWidgetTtlSec(): number {
  const raw = Deno.env.get('EIGEN_WIDGET_SESSION_TTL_SEC') ?? '600';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 60) return 600;
  return Math.min(parsed, 3600);
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(signature),
    encoder.encode(data),
  );
}

export async function createWidgetSessionToken(
  input: Omit<WidgetSessionClaims, 'iat' | 'exp'>,
): Promise<{ token: string; expires_at: string; claims: WidgetSessionClaims }> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = readWidgetTtlSec();
  const claims: WidgetSessionClaims = {
    ...input,
    iat: now,
    exp: now + ttl,
  };

  const payload = JSON.stringify(claims);
  const encodedPayload = toBase64Url(encoder.encode(payload));
  const secret = readWidgetSecret();
  const signature = await sign(encodedPayload, secret);
  const token = `${encodedPayload}.${signature}`;
  return {
    token,
    expires_at: new Date(claims.exp * 1000).toISOString(),
    claims,
  };
}

export async function verifyWidgetSessionToken(token: string): Promise<WidgetSessionClaims> {
  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) {
    throw new Error('Invalid widget session token format');
  }
  const secret = readWidgetSecret();
  const ok = await verify(payloadPart, sigPart, secret);
  if (!ok) throw new Error('Invalid widget session token signature');

  const payloadJson = decoder.decode(fromBase64Url(payloadPart));
  const claims = JSON.parse(payloadJson) as WidgetSessionClaims;
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < now) throw new Error('Widget session token expired');
  return claims;
}
