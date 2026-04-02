/**
 * Shared event envelope — the canonical wrapper for every domain event
 * emitted by any R2 service.
 *
 * Implements the recommendations from ARCHITECTURE_REVIEW.md:
 * - idempotency_key for dedup
 * - correlation_id for distributed tracing
 * - causation_id for causal chains
 * - event_version for schema evolution
 * - producer for origin identification
 */

export interface EventEnvelope<T = unknown> {
  /** Unique event ID (UUID v4). */
  id: string;
  /** Domain that produced this event (e.g., 'charter', 'oracle', 'eigen'). */
  producer: string;
  /** Dot-namespaced event type (e.g., 'charter.governance.transitioned'). */
  eventType: string;
  /** Schema version for this event type (integer, monotonically increasing). */
  eventVersion: number;
  /** Idempotency key — callers must supply; dedup is enforced at the DB layer. */
  idempotencyKey: string;
  /** Correlation ID — ties related events across services (e.g., a user action). */
  correlationId: string;
  /** Causation ID — the event ID that directly caused this event (nullable for root events). */
  causationId: string | null;
  /** ISO 8601 UTC timestamp when the event occurred. */
  occurredAt: string;
  /** The typed payload. */
  payload: T;
  /** Optional metadata bag for tracing, tags, etc. */
  metadata?: Record<string, unknown>;
}

export interface CreateEventEnvelopeInput<T = unknown> {
  producer: string;
  eventType: string;
  eventVersion?: number;
  idempotencyKey: string;
  correlationId: string;
  causationId?: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

/** Factory to create a well-formed event envelope with defaults. */
export function createEventEnvelope<T>(input: CreateEventEnvelopeInput<T>): EventEnvelope<T> {
  return {
    id: crypto.randomUUID(),
    producer: input.producer,
    eventType: input.eventType,
    eventVersion: input.eventVersion ?? 1,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    occurredAt: new Date().toISOString(),
    payload: input.payload,
    metadata: input.metadata,
  };
}
