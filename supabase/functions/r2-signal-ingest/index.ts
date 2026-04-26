import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { guardAuth } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { requireIdempotencyKey } from '../_shared/validate.ts';
import { buildSourceSignalKey, verifySignalHmac } from '../_shared/signal-utils.ts';
import {
  SIGNAL_CONTRACT_VERSION,
  validateR2SignalEnvelope,
  type R2SignalEnvelope,
} from '../../../packages/r2-signal-contract/src/index.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildInsertRow(envelope: R2SignalEnvelope, sourceSignalKey: string) {
  return {
    contract_version: envelope.contract_version,
    source_system: envelope.source_system,
    source_repo: envelope.source_repo,
    source_event_type: envelope.source_event_type,
    source_signal_key: sourceSignalKey,
    actor_meg_entity_id: envelope.actor_meg_entity_id,
    related_entity_ids: envelope.related_entity_ids,
    event_time: envelope.event_time,
    summary: envelope.summary,
    payload: envelope.raw_payload,
    confidence: envelope.confidence,
    privacy_level: envelope.privacy_level,
    provenance: envelope.provenance,
    routing_targets: envelope.routing_targets,
    ingest_run_id: envelope.ingest_run_id ?? null,
  };
}

async function maybeVerifyHmac(req: Request, body: string): Promise<Response | null> {
  const sharedSecret = Deno.env.get('R2_SIGNAL_INGEST_HMAC_SECRET')?.trim();
  if (!sharedSecret) return null;
  if (!req.headers.get('x-r2-signature')) {
    return errorResponse('Missing x-r2-signature header', 401);
  }
  const ok = await verifySignalHmac(sharedSecret, body, req.headers.get('x-r2-signature'));
  if (!ok) {
    return errorResponse('Invalid x-r2-signature', 401);
  }
  return null;
}

function toValidationMessage(input: unknown): string {
  if (!isObject(input)) return 'Request body must be a JSON object';
  return JSON.stringify(input);
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim();
    if (!idempotencyKey) return errorResponse('Missing x-idempotency-key', 400);

    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return errorResponse('Failed to read request body', 400);
    }

    const hmacError = await maybeVerifyHmac(req, rawBody);
    if (hmacError) return hmacError;

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const parsedEnvelope = validateR2SignalEnvelope(parsedBody);
    if (!parsedEnvelope.ok) {
      return errorResponse(toValidationMessage({ error: parsedEnvelope.issues }), 400);
    }
    const envelope = parsedEnvelope.data;
    if (envelope.contract_version !== SIGNAL_CONTRACT_VERSION) {
      return errorResponse(`Unsupported contract version ${envelope.contract_version}`, 400);
    }

    const sourceSignalKey = buildSourceSignalKey(envelope.source_system, idempotencyKey);
    const client = getServiceClient();

    const insertResult = await client
      .from('platform_feed_items')
      .insert(buildInsertRow(envelope, sourceSignalKey))
      .select('id')
      .single();

    let signalId: string | null = null;
    if (!insertResult.error && insertResult.data?.id) {
      signalId = insertResult.data.id as string;
    } else if (insertResult.error && (insertResult.error as { code?: string }).code === '23505') {
      const existing = await client
        .from('platform_feed_items')
        .select('id')
        .eq('source_signal_key', sourceSignalKey)
        .maybeSingle();
      if (existing.error || !existing.data?.id) {
        return errorResponse(existing.error?.message ?? 'Failed to resolve idempotent replay', 500);
      }
      signalId = existing.data.id as string;
    } else {
      return errorResponse(insertResult.error?.message ?? 'Failed to insert signal', 500);
    }

    const enqueue = await client.rpc('enqueue_platform_feed_processing', { signal_id: signalId });
    if (enqueue.error) {
      return errorResponse(enqueue.error.message, 500);
    }

    return jsonResponse({ signal_id: signalId }, 202);
  }),
);
