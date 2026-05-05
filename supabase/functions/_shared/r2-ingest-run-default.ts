import {
  SIGNAL_BOUNDS,
  type R2SignalEnvelope,
} from '../../../packages/r2-signal-contract/src/index.ts';
import { isWave1SourceSystem } from './wave1-signal-metadata.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wave 1 producers carry ingest run id in `raw_payload.ingest_run.id`.
 * Non–Wave-1 sources never read payload run ids.
 */
export function tryExtractWave1RunId(envelope: R2SignalEnvelope): string | null {
  if (!isWave1SourceSystem(envelope.source_system)) return null;
  const payload = envelope.raw_payload;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }
  const ingestRun = (payload as Record<string, unknown>).ingest_run;
  if (typeof ingestRun !== 'object' || ingestRun === null || Array.isArray(ingestRun)) {
    return null;
  }
  const id = (ingestRun as Record<string, unknown>).id;
  return typeof id === 'string' && UUID_RE.test(id) ? id : null;
}

export function withServerDefaultProvenance(
  provenance: Record<string, unknown>,
  source: 'wave1_payload' | 'server_default',
): Record<string, unknown> {
  const encoder = new TextEncoder();
  const max = SIGNAL_BOUNDS.provenanceMaxJsonBytes;
  const stamp = new Date().toISOString();
  const { _r2: existingRaw, ...rest } = provenance;
  const r2Base = isObject(existingRaw) ? { ...(existingRaw as Record<string, unknown>) } : {};

  const withSource: Record<string, unknown> = {
    ...rest,
    _r2: { ...r2Base, ingest_run_source: source },
  };
  if (encoder.encode(JSON.stringify(withSource)).byteLength > max) return provenance;

  const withBoth: Record<string, unknown> = {
    ...rest,
    _r2: { ...r2Base, ingest_run_source: source, server_default_at: stamp },
  };
  if (encoder.encode(JSON.stringify(withBoth)).byteLength <= max) return withBoth;
  return withSource;
}

/** Resolves `ingest_run_id` column value and provenance when `ingest_run_id` is omitted on the envelope. */
export function resolveIngestRunIdAndProvenance(envelope: R2SignalEnvelope): {
  ingestRunId: string;
  provenance: Record<string, unknown>;
} {
  const providedRunId = envelope.ingest_run_id ?? null;
  if (providedRunId) {
    return {
      ingestRunId: providedRunId,
      provenance: envelope.provenance as Record<string, unknown>,
    };
  }
  const wave1Id = tryExtractWave1RunId(envelope);
  if (wave1Id) {
    return {
      ingestRunId: wave1Id,
      provenance: withServerDefaultProvenance(
        envelope.provenance as Record<string, unknown>,
        'wave1_payload',
      ),
    };
  }
  return {
    ingestRunId: crypto.randomUUID(),
    provenance: withServerDefaultProvenance(
      envelope.provenance as Record<string, unknown>,
      'server_default',
    ),
  };
}
