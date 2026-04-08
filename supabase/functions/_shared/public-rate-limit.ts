import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sha256Hex } from './eigen.ts';

function readPublicRateLimitPerMinute(): number {
  const raw = Deno.env.get('EIGEN_PUBLIC_RATE_LIMIT_PER_MIN') ?? '30';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(n, 600);
}

function firstHeaderValue(headers: Headers, key: string): string | null {
  const raw = headers.get(key);
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim() ?? '';
  return first.length > 0 ? first : null;
}

export function getRequesterFingerprint(req: Request): string {
  const ip =
    firstHeaderValue(req.headers, 'cf-connecting-ip') ??
    firstHeaderValue(req.headers, 'x-real-ip') ??
    firstHeaderValue(req.headers, 'x-forwarded-for') ??
    'unknown-ip';
  const userAgent = req.headers.get('user-agent') ?? 'unknown-ua';
  const acceptLang = req.headers.get('accept-language') ?? 'unknown-lang';
  return `${ip}|${userAgent}|${acceptLang}`;
}

export async function enforceEigenPublicRateLimit(
  client: SupabaseClient,
  req: Request,
): Promise<{ ok: true; limit: number; remaining: number } | { ok: false; retryAfterSec: number; limit: number }> {
  const limit = readPublicRateLimitPerMinute();
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCSeconds(0, 0);

  const fingerprint = getRequesterFingerprint(req);
  const bucketKey = await sha256Hex(`eigen-public:${fingerprint}`);
  const bump = await client.rpc('bump_eigen_public_rate', {
    p_bucket_key: bucketKey,
    p_window_start: windowStart.toISOString(),
  });

  if (bump.error) {
    throw new Error(`Rate limit check failed: ${bump.error.message}`);
  }

  const count = Number(bump.data ?? 0);
  if (!Number.isFinite(count)) {
    throw new Error('Rate limit check returned invalid count');
  }

  if (count > limit) {
    const retryAfterSec = Math.max(1, 60 - now.getUTCSeconds());
    return { ok: false, retryAfterSec, limit };
  }

  return { ok: true, limit, remaining: Math.max(0, limit - count) };
}
