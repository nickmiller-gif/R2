import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOraclePublicationService,
  type OraclePublicationDb,
  type DbOraclePublicationEventRow,
} from '../../src/services/oracle/oracle-publication.service.js';
import type { OraclePublicationState } from '../../src/types/oracle/shared.js';

function makeMockDb(): OraclePublicationDb & {
  thesisStateById: Map<string, OraclePublicationState>;
  signalStateById: Map<string, OraclePublicationState>;
  events: DbOraclePublicationEventRow[];
} {
  const thesisStateById = new Map<string, OraclePublicationState>();
  const signalStateById = new Map<string, OraclePublicationState>();
  const events: DbOraclePublicationEventRow[] = [];

  return {
    thesisStateById,
    signalStateById,
    events,

    async findThesisPublicationStateById(id) {
      return thesisStateById.get(id) ?? null;
    },
    async updateThesisPublicationState(id, patch) {
      thesisStateById.set(id, patch.publication_state);
    },
    async findSignalPublicationStateById(id) {
      return signalStateById.get(id) ?? null;
    },
    async updateSignalPublicationState(id, patch) {
      signalStateById.set(id, patch.publication_state);
    },
    async insertPublicationEvent(row) {
      events.push(row);
      return row;
    },
    async queryPublicationEvents(targetType) {
      if (!targetType) return events;
      return events.filter((e) => e.target_type === targetType);
    },
  };
}

describe('OraclePublicationService', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('publishes thesis and records event', async () => {
    db.thesisStateById.set('thesis-1', 'approved');
    const service = createOraclePublicationService(db);

    const event = await service.decideThesis('thesis-1', 'published', 'user-1', 'ready');

    expect(event.targetType).toBe('thesis');
    expect(event.fromState).toBe('approved');
    expect(event.toState).toBe('published');
    expect(db.thesisStateById.get('thesis-1')).toBe('published');
    expect(db.events).toHaveLength(1);
  });

  it('rejects signal and records transition', async () => {
    db.signalStateById.set('signal-1', 'pending_review');
    const service = createOraclePublicationService(db);

    const event = await service.decideSignal('signal-1', 'rejected', 'user-2', 'insufficient evidence');

    expect(event.targetType).toBe('signal');
    expect(event.fromState).toBe('pending_review');
    expect(event.toState).toBe('rejected');
    expect(db.signalStateById.get('signal-1')).toBe('rejected');
  });

  it('throws on invalid transition', async () => {
    db.thesisStateById.set('thesis-2', 'rejected');
    const service = createOraclePublicationService(db);

    await expect(service.decideThesis('thesis-2', 'published', 'user-3')).rejects.toThrow(
      'Invalid publication transition',
    );
  });
});

