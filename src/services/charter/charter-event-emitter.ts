import { createEventEnvelope } from '../../types/shared/event-envelope.js';
import type { EventEnvelope } from '../../types/shared/event-envelope.js';

export type CharterEventType =
  | 'charter.entity.created'
  | 'charter.entity.updated'
  | 'charter.entity.archived'
  | 'charter.right.created'
  | 'charter.right.updated'
  | 'charter.obligation.created'
  | 'charter.obligation.fulfilled'
  | 'charter.evidence.submitted'
  | 'charter.evidence.verified'
  | 'charter.payout.created'
  | 'charter.payout.approved'
  | 'charter.payout.disbursed'
  | 'charter.decision.created'
  | 'charter.decision.finalized'
  | 'charter.context.linked'
  | 'charter.context.refreshed'
  | 'charter.governance.transitioned';

export interface CharterEventSink {
  emit(envelope: EventEnvelope<unknown>): Promise<void>;
}

export interface CharterEventEmitter {
  emit(params: {
    eventType: CharterEventType;
    payload: unknown;
    idempotencyKey: string;
    correlationId: string;
    causationId?: string;
  }): Promise<EventEnvelope<unknown>>;
}

export function createCharterEventEmitter(sink: CharterEventSink): CharterEventEmitter {
  return {
    async emit({ eventType, payload, idempotencyKey, correlationId, causationId }) {
      const envelope = createEventEnvelope({
        producer: 'charter',
        eventType,
        idempotencyKey,
        correlationId,
        causationId,
        payload,
      });
      await sink.emit(envelope);
      return envelope;
    },
  };
}
