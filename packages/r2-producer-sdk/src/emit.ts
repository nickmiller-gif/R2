import {
  normalizeR2SignalEnvelope,
  validateR2SignalEnvelope,
  type R2SignalEnvelope,
  type SignalValidationResult,
} from '../../r2-signal-contract/src/index.ts';
import { signHmacSha256Hex } from './hmac.ts';

export type EmitR2SignalConfig = {
  ingestUrl: string;
  bearer: string;
  hmacSecret: string;
  /** Supabase anon/publishable key when the gateway expects `apikey`. */
  apikey?: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
};

export type EmitR2SignalResult =
  | { ok: true; status: number; body: string }
  | { ok: false; status: number; body: string }
  | { ok: false; validation: SignalValidationResult };

export function buildR2SignalRequest(
  envelope: R2SignalEnvelope,
  config: EmitR2SignalConfig,
): { headers: Record<string, string>; body: string } | { validation: SignalValidationResult } {
  const validated = validateR2SignalEnvelope(normalizeR2SignalEnvelope(envelope));
  if (!validated.ok) return { validation: validated };

  const body = JSON.stringify(validated.data);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.bearer}`,
    'x-idempotency-key': config.idempotencyKey,
  };
  if (config.apikey) headers.apikey = config.apikey;

  return { headers, body };
}

export async function signR2SignalBody(
  body: string,
  hmacSecret: string,
): Promise<Record<string, string>> {
  const sig = await signHmacSha256Hex(hmacSecret, body);
  return { 'x-r2-signature': sig };
}

/**
 * POST a validated signal-contract v1 envelope to r2-signal-ingest.
 * Validates envelope shape before signing (fail closed).
 */
export async function emitR2Signal(
  envelope: R2SignalEnvelope,
  config: EmitR2SignalConfig,
): Promise<EmitR2SignalResult> {
  const built = buildR2SignalRequest(envelope, config);
  if ('validation' in built) return { ok: false, validation: built.validation };

  const sigHeaders = await signR2SignalBody(built.body, config.hmacSecret);
  const fetchFn = config.fetchImpl ?? fetch;
  const res = await fetchFn(config.ingestUrl, {
    method: 'POST',
    headers: { ...built.headers, ...sigHeaders },
    body: built.body,
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  return { ok: true, status: res.status, body: text };
}
