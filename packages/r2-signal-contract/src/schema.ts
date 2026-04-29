import {
  R2_SIGNAL_PRIVACY_LEVELS,
  R2_SIGNAL_ROUTING_TARGETS,
  R2_SIGNAL_SOURCE_SYSTEMS,
  SIGNAL_CONTRACT_VERSION,
  type R2SignalEnvelope,
  type R2SignalPrivacyLevel,
  type R2SignalRoutingTarget,
  type R2SignalSourceSystem,
} from './v1.ts';

export type SignalValidationIssue = {
  path: string;
  message: string;
};

export type SignalValidationResult =
  | { ok: true; data: R2SignalEnvelope }
  | { ok: false; issues: SignalValidationIssue[] };

// Field-level upper bounds. Mirrored by DB CHECK constraints on
// platform_feed_items so any drift fails closed at the storage layer.
export const SIGNAL_BOUNDS = {
  sourceRepoMaxLength: 200,
  sourceEventTypeMaxLength: 100,
  summaryMaxLength: 280,
  rawPayloadMaxJsonBytes: 64 * 1024,
  provenanceMaxJsonBytes: 8 * 1024,
  relatedEntityIdsMax: 100,
  routingTargetsMax: R2_SIGNAL_ROUTING_TARGETS.length,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSourceSystem(value: string): value is R2SignalSourceSystem {
  return (R2_SIGNAL_SOURCE_SYSTEMS as readonly string[]).includes(value);
}

function isPrivacyLevel(value: string): value is R2SignalPrivacyLevel {
  return (R2_SIGNAL_PRIVACY_LEVELS as readonly string[]).includes(value);
}

function isRoutingTargets(value: unknown): value is R2SignalRoutingTarget[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string' && (R2_SIGNAL_ROUTING_TARGETS as readonly string[]).includes(item),
    )
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isIsoDateTime(input: string): boolean {
  if (!input.includes('T')) return false;
  return Number.isFinite(Date.parse(input));
}

function jsonByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? '').length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validateR2SignalEnvelope(input: unknown): SignalValidationResult {
  const issues: SignalValidationIssue[] = [];

  if (!isObject(input)) {
    return { ok: false, issues: [{ path: '$', message: 'Envelope must be an object.' }] };
  }

  const record = input;

  if (record.contract_version !== SIGNAL_CONTRACT_VERSION) {
    issues.push({
      path: 'contract_version',
      message: `contract_version must be ${SIGNAL_CONTRACT_VERSION}.`,
    });
  }

  if (typeof record.source_system !== 'string' || !isSourceSystem(record.source_system)) {
    issues.push({
      path: 'source_system',
      message: 'source_system must be one of the supported source systems.',
    });
  }

  if (typeof record.source_repo !== 'string' || record.source_repo.trim().length === 0) {
    issues.push({ path: 'source_repo', message: 'source_repo is required.' });
  } else if (record.source_repo.length > SIGNAL_BOUNDS.sourceRepoMaxLength) {
    issues.push({
      path: 'source_repo',
      message: `source_repo must be <= ${SIGNAL_BOUNDS.sourceRepoMaxLength} characters.`,
    });
  }

  if (
    typeof record.source_event_type !== 'string' ||
    record.source_event_type.trim().length === 0
  ) {
    issues.push({ path: 'source_event_type', message: 'source_event_type is required.' });
  } else if (record.source_event_type.length > SIGNAL_BOUNDS.sourceEventTypeMaxLength) {
    issues.push({
      path: 'source_event_type',
      message: `source_event_type must be <= ${SIGNAL_BOUNDS.sourceEventTypeMaxLength} characters.`,
    });
  }

  if (record.actor_meg_entity_id !== null && !isUuid(record.actor_meg_entity_id)) {
    issues.push({
      path: 'actor_meg_entity_id',
      message: 'actor_meg_entity_id must be a UUID string or null.',
    });
  }

  if (!isStringArray(record.related_entity_ids)) {
    issues.push({
      path: 'related_entity_ids',
      message: 'related_entity_ids must be an array of strings.',
    });
  } else {
    if (record.related_entity_ids.length > SIGNAL_BOUNDS.relatedEntityIdsMax) {
      issues.push({
        path: 'related_entity_ids',
        message: `related_entity_ids must contain <= ${SIGNAL_BOUNDS.relatedEntityIdsMax} entries.`,
      });
    }
    if (!record.related_entity_ids.every(isUuid)) {
      issues.push({
        path: 'related_entity_ids',
        message: 'related_entity_ids must contain only UUID strings.',
      });
    }
  }

  if (typeof record.event_time !== 'string' || !isIsoDateTime(record.event_time)) {
    issues.push({
      path: 'event_time',
      message: 'event_time must be an RFC-3339/ISO-8601 timestamp string.',
    });
  }

  if (typeof record.summary !== 'string' || record.summary.trim().length === 0) {
    issues.push({ path: 'summary', message: 'summary is required.' });
  } else if (record.summary.length > SIGNAL_BOUNDS.summaryMaxLength) {
    issues.push({
      path: 'summary',
      message: `summary must be <= ${SIGNAL_BOUNDS.summaryMaxLength} characters.`,
    });
  }

  if (!isObject(record.raw_payload)) {
    issues.push({ path: 'raw_payload', message: 'raw_payload must be an object.' });
  } else if (jsonByteLength(record.raw_payload) > SIGNAL_BOUNDS.rawPayloadMaxJsonBytes) {
    issues.push({
      path: 'raw_payload',
      message: `raw_payload JSON must be <= ${SIGNAL_BOUNDS.rawPayloadMaxJsonBytes} bytes.`,
    });
  }

  if (typeof record.confidence !== 'number' || Number.isNaN(record.confidence)) {
    issues.push({ path: 'confidence', message: 'confidence must be a number in [0, 1].' });
  } else if (record.confidence < 0 || record.confidence > 1) {
    issues.push({ path: 'confidence', message: 'confidence must be in [0, 1].' });
  }

  if (typeof record.privacy_level !== 'string' || !isPrivacyLevel(record.privacy_level)) {
    issues.push({
      path: 'privacy_level',
      message: 'privacy_level must be one of public|members|operator|private.',
    });
  }

  if (!isObject(record.provenance)) {
    issues.push({ path: 'provenance', message: 'provenance must be an object.' });
  } else if (jsonByteLength(record.provenance) > SIGNAL_BOUNDS.provenanceMaxJsonBytes) {
    issues.push({
      path: 'provenance',
      message: `provenance JSON must be <= ${SIGNAL_BOUNDS.provenanceMaxJsonBytes} bytes.`,
    });
  }

  if (!isRoutingTargets(record.routing_targets)) {
    issues.push({
      path: 'routing_targets',
      message: 'routing_targets must be an array of supported routing targets.',
    });
  } else if (record.routing_targets.length > SIGNAL_BOUNDS.routingTargetsMax) {
    issues.push({
      path: 'routing_targets',
      message: `routing_targets must contain <= ${SIGNAL_BOUNDS.routingTargetsMax} entries.`,
    });
  }

  if (record.ingest_run_id !== undefined && !isUuid(record.ingest_run_id)) {
    issues.push({
      path: 'ingest_run_id',
      message: 'ingest_run_id must be a UUID string when present.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, data: record as R2SignalEnvelope };
}
