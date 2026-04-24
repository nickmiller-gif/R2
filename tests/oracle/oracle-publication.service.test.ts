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

    const event = await service.decideSignal(
      'signal-1',
      'rejected',
      'user-2',
      'insufficient evidence',
    );

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

  it('allows thesis supersede from published', async () => {
    db.thesisStateById.set('thesis-3', 'published');
    const service = createOraclePublicationService(db);

    const event = await service.decideThesis('thesis-3', 'superseded', 'user-4', 'rescored');

    expect(event.fromState).toBe('published');
    expect(event.toState).toBe('superseded');
    expect(db.thesisStateById.get('thesis-3')).toBe('superseded');
  });

  it('allows signal supersede from pending_review', async () => {
    db.signalStateById.set('signal-2', 'pending_review');
    const service = createOraclePublicationService(db);

    const event = await service.decideSignal('signal-2', 'superseded', 'user-5');

    expect(event.toState).toBe('superseded');
    expect(db.signalStateById.get('signal-2')).toBe('superseded');
  });

  it('treats superseded as terminal', async () => {
    db.thesisStateById.set('thesis-4', 'superseded');
    const service = createOraclePublicationService(db);

    await expect(service.decideThesis('thesis-4', 'published', 'user-6')).rejects.toThrow(
      'Invalid publication transition',
    );
  });

  it('treats successor_of as terminal', async () => {
    db.thesisStateById.set('thesis-5', 'successor_of');
    const service = createOraclePublicationService(db);

    await expect(service.decideThesis('thesis-5', 'rejected', 'user-7')).rejects.toThrow(
      'Invalid publication transition',
    );
  });

  it('filters listEvents by target type', async () => {
    db.thesisStateById.set('thesis-6', 'approved');
    db.signalStateById.set('signal-3', 'approved');
    const service = createOraclePublicationService(db);
    await service.decideThesis('thesis-6', 'published', 'user-8');
    await service.decideSignal('signal-3', 'published', 'user-9');

    const thesisEvents = await service.listEvents('thesis');
    const signalEvents = await service.listEvents('signal');

    expect(thesisEvents).toHaveLength(1);
    expect(thesisEvents[0].targetType).toBe('thesis');
    expect(signalEvents).toHaveLength(1);
    expect(signalEvents[0].targetType).toBe('signal');
  });
});
