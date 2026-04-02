/**
 * Tests for the shared event envelope factory.
 */
import { describe, it, expect } from 'vitest';
import { createEventEnvelope } from '../../src/types/shared/event-envelope.js';

describe('createEventEnvelope', () => {
  it('creates a well-formed envelope with defaults', () => {
    const envelope = createEventEnvelope({
      producer: 'oracle',
      eventType: 'oracle.signal.created',
      idempotencyKey: 'idem-1',
      correlationId: 'corr-1',
      payload: { score: 75 },
    });

    expect(envelope.id).toBeTruthy();
    expect(envelope.producer).toBe('oracle');
    expect(envelope.eventType).toBe('oracle.signal.created');
    expect(envelope.eventVersion).toBe(1);
    expect(envelope.idempotencyKey).toBe('idem-1');
    expect(envelope.correlationId).toBe('corr-1');
    expect(envelope.causationId).toBeNull();
    expect(envelope.occurredAt).toBeTruthy();
    expect(envelope.payload).toEqual({ score: 75 });
  });

  it('accepts explicit version and causation ID', () => {
    const envelope = createEventEnvelope({
      producer: 'charter',
      eventType: 'charter.governance.transitioned',
      eventVersion: 2,
      idempotencyKey: 'idem-2',
      correlationId: 'corr-2',
      causationId: 'cause-1',
      payload: { toStatus: 'active' },
    });

    expect(envelope.eventVersion).toBe(2);
    expect(envelope.causationId).toBe('cause-1');
  });

  it('generates unique IDs per envelope', () => {
    const a = createEventEnvelope({
      producer: 'test', eventType: 'test', idempotencyKey: 'a',
      correlationId: 'c', payload: {},
    });
    const b = createEventEnvelope({
      producer: 'test', eventType: 'test', idempotencyKey: 'b',
      correlationId: 'c', payload: {},
    });

    expect(a.id).not.toBe(b.id);
  });
});
