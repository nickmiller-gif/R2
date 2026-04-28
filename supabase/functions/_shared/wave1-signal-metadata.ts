import type { R2SignalEnvelope } from '../../../packages/r2-signal-contract/src/index.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const WAVE1_SOURCE_SYSTEMS = new Set(['rays_retreat', 'operator_workbench', 'oracle_operator']);
const EVIDENCE_TIERS = new Set(['A', 'B', 'C', 'D', 'E']);

/** Max entries in `sources_queried` per Wave 1 envelope (abuse + payload bounds). */
export const WAVE1_MAX_SOURCES_QUERIED = 64;
/** Max UTF-16 code units per `sources_queried` entry. */
export const WAVE1_MAX_SOURCE_QUERY_ENTRY_CHARS = 512;

export type Wave1MetadataValidation =
  | { ok: true }
  | { ok: false; code: string; message: string; detail?: string };

function ensureString(value: unknown, label: string): Wave1MetadataValidation {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: `${label} must be a non-empty string`,
    };
  }
  return { ok: true };
}

export function isWave1SourceSystem(sourceSystem: string): boolean {
  return WAVE1_SOURCE_SYSTEMS.has(sourceSystem);
}

export function validateWave1Metadata(envelope: R2SignalEnvelope): Wave1MetadataValidation {
  if (!WAVE1_SOURCE_SYSTEMS.has(envelope.source_system)) return { ok: true };
  const payload = envelope.raw_payload;
  if (!isObject(payload)) {
    return {
      ok: false,
      code: 'wave1_metadata_missing',
      message: 'raw_payload must be an object for Wave 1 sources',
    };
  }

  const ingestRun = payload.ingest_run;
  if (!isObject(ingestRun)) {
    return {
      ok: false,
      code: 'wave1_metadata_missing',
      message: 'raw_payload.ingest_run is required for Wave 1 sources',
    };
  }
  const runIdResult = ensureString(ingestRun.id, 'raw_payload.ingest_run.id');
  if (!runIdResult.ok) return runIdResult;
  const sourceResult = ensureString(
    ingestRun.source_system,
    'raw_payload.ingest_run.source_system',
  );
  if (!sourceResult.ok) return sourceResult;
  if ((ingestRun.source_system as string) !== envelope.source_system) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.ingest_run.source_system must match source_system',
    };
  }
  const startedAtResult = ensureString(ingestRun.started_at, 'raw_payload.ingest_run.started_at');
  if (!startedAtResult.ok) return startedAtResult;
  if (Number.isNaN(Date.parse(String(ingestRun.started_at)))) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.ingest_run.started_at must be a valid ISO-8601 timestamp',
    };
  }
  const triggerResult = ensureString(ingestRun.trigger, 'raw_payload.ingest_run.trigger');
  if (!triggerResult.ok) return triggerResult;

  if (typeof payload.evidence_tier !== 'string' || !EVIDENCE_TIERS.has(payload.evidence_tier)) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.evidence_tier must be one of A,B,C,D,E',
    };
  }
  if (!Array.isArray(payload.sources_queried) || payload.sources_queried.length === 0) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.sources_queried must be a non-empty array',
    };
  }
  const badSource = payload.sources_queried.find(
    (entry) => typeof entry !== 'string' || entry.trim().length === 0,
  );
  if (badSource !== undefined) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.sources_queried entries must be non-empty strings',
    };
  }
  if (payload.sources_queried.length > WAVE1_MAX_SOURCES_QUERIED) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: `raw_payload.sources_queried must have at most ${WAVE1_MAX_SOURCES_QUERIED} entries`,
    };
  }
  const oversizedEntry = payload.sources_queried.find(
    (entry) => typeof entry === 'string' && entry.length > WAVE1_MAX_SOURCE_QUERY_ENTRY_CHARS,
  );
  if (oversizedEntry !== undefined) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: `raw_payload.sources_queried entries must be at most ${WAVE1_MAX_SOURCE_QUERY_ENTRY_CHARS} characters`,
    };
  }
  if (typeof payload.adversarial_pass !== 'boolean') {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.adversarial_pass must be boolean',
    };
  }
  if (typeof payload.registry_verified_ratio !== 'number') {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.registry_verified_ratio must be numeric in [0,1]',
    };
  }
  if (!Number.isFinite(payload.registry_verified_ratio)) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.registry_verified_ratio must be numeric in [0,1]',
    };
  }
  if (payload.registry_verified_ratio < 0 || payload.registry_verified_ratio > 1) {
    return {
      ok: false,
      code: 'wave1_metadata_invalid',
      message: 'raw_payload.registry_verified_ratio must be numeric in [0,1]',
    };
  }
  return { ok: true };
}
