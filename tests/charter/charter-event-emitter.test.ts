import { describe, it, expect } from 'vitest';
import {
  createCharterEventEmitter,
  type CharterEventEmitter,
  type CharterEventSink,
} from '../../src/services/charter/charter-event-emitter.js';
import type { EventEnvelope } from '../../src/types/shared/event-envelope.js';

describe('CharterEventEmitter', () => {
  const createMockSink = (): { sink: CharterEventSink; emitted: EventEnvelope<unknown>[] } => {
    const emitted: EventEnvelope<unknown>[] = [];

    return {
      sink: {
        async emit(envelope: EventEnvelope<unknown>) {
          emitted.push(envelope);
        },
      },
      emitted,
    };
  };

  it('should emit event with correct producer=charter', async () => {
    const { sink, emitted } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    await emitter.emit({
      eventType: 'charter.entity.created',
      payload: { entityId: 'entity-1' },
      idempotencyKey: 'idempotent-key-1',
      correlationId: 'correlation-id-1',
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].producer).toBe('charter');
  });

  it('should wrap payload in event envelope', async () => {
    const { sink, emitted } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    const testPayload = { entityId: 'entity-2', action: 'update' };
    await emitter.emit({
      eventType: 'charter.entity.updated',
      payload: testPayload,
      idempotencyKey: 'idempotent-key-2',
      correlationId: 'correlation-id-2',
    });

    expect(emitted[0].payload).toEqual(testPayload);
  });

  it('should forward to sink', async () => {
    const { sink, emitted } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    await emitter.emit({
      eventType: 'charter.right.created',
      payload: { rightId: 'right-1' },
      idempotencyKey: 'idempotent-key-3',
      correlationId: 'correlation-id-3',
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].eventType).toBe('charter.right.created');
  });

  it('should include causation ID when provided', async () => {
    const { sink, emitted } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    await emitter.emit({
      eventType: 'charter.obligation.fulfilled',
      payload: { obligationId: 'obligation-1' },
      idempotencyKey: 'idempotent-key-4',
      correlationId: 'correlation-id-4',
      causationId: 'cause-event-id',
    });

    expect(emitted[0].causationId).toBe('cause-event-id');
  });

  it('should set causation ID to null when not provided', async () => {
    const { sink, emitted } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    await emitter.emit({
      eventType: 'charter.context.linked',
      payload: { contextId: 'context-1' },
      idempotencyKey: 'idempotent-key-5',
      correlationId: 'correlation-id-5',
    });

    expect(emitted[0].causationId).toBeNull();
  });

  it('should return emitted envelope', async () => {
    const { sink } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    const envelope = await emitter.emit({
      eventType: 'charter.governance.transitioned',
      payload: { transitionId: 'transition-1' },
      idempotencyKey: 'idempotent-key-6',
      correlationId: 'correlation-id-6',
    });

    expect(envelope.id).toBeDefined();
    expect(envelope.producer).toBe('charter');
    expect(envelope.eventType).toBe('charter.governance.transitioned');
    expect(envelope.idempotencyKey).toBe('idempotent-key-6');
    expect(envelope.correlationId).toBe('correlation-id-6');
  });

  it('should generate unique event IDs for each emit', async () => {
    const { sink, emitted } = createMockSink();
    const emitter = createCharterEventEmitter(sink);

    await emitter.emit({
      eventType: 'charter.entity.created',
      payload: {},
      idempotencyKey: 'idempotent-key-7a',
      correlationId: 'correlation-id-7',
    });

    await emitter.emit({
      eventType: 'charter.entity.created',
      payload: {},
      idempotencyKey: 'idempotent-key-7b',
      correlationId: 'correlation-id-7',
    });

    expect(emitted[0].id).not.toBe(emitted[1].id);
  });
});
