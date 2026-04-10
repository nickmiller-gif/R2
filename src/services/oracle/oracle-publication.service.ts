/**
 * Oracle publication workflow service.
 *
 * Encapsulates publication state transitions and immutable publication events.
 */
import { nowUtc } from '../../lib/provenance/clock.js';
import type { OraclePublicationState } from '../../types/oracle/shared.js';
import type {
  CreateOraclePublicationEventInput,
  OraclePublicationRecord,
} from '../../types/oracle/publication.js';
import { parseJsonbField } from './oracle-db-utils.js';

export interface DbOraclePublicationEventRow {
  id: string;
  target_type: 'thesis' | 'signal';
  target_id: string;
  from_state: string | null;
  to_state: string;
  decided_by: string;
  decided_at: string;
  notes: string | null;
  metadata: unknown;
}

export interface OraclePublicationDb {
  findThesisPublicationStateById(id: string): Promise<OraclePublicationState | null>;
  updateThesisPublicationState(
    id: string,
    patch: {
      publication_state: OraclePublicationState;
      published_at: string | null;
      published_by: string | null;
      last_decision_at: string;
      last_decision_by: string;
      decision_metadata: string;
      updated_at: string;
    },
  ): Promise<void>;
  findSignalPublicationStateById(id: string): Promise<OraclePublicationState | null>;
  updateSignalPublicationState(
    id: string,
    patch: {
      publication_state: OraclePublicationState;
      published_at: string | null;
      published_by: string | null;
      publication_notes: string | null;
      updated_at: string;
    },
  ): Promise<void>;
  insertPublicationEvent(row: DbOraclePublicationEventRow): Promise<DbOraclePublicationEventRow>;
  queryPublicationEvents(targetType?: 'thesis' | 'signal'): Promise<DbOraclePublicationEventRow[]>;
}

export interface OraclePublicationService {
  decideThesis(
    thesisId: string,
    toState: OraclePublicationState,
    decidedBy: string,
    notes?: string | null,
  ): Promise<OraclePublicationRecord>;
  decideSignal(
    signalId: string,
    toState: OraclePublicationState,
    decidedBy: string,
    notes?: string | null,
  ): Promise<OraclePublicationRecord>;
  listEvents(targetType?: 'thesis' | 'signal'): Promise<OraclePublicationRecord[]>;
}

function rowToEvent(row: DbOraclePublicationEventRow): OraclePublicationRecord {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    fromState: (row.from_state as OraclePublicationState | null) ?? null,
    toState: row.to_state as OraclePublicationState,
    decidedBy: row.decided_by,
    decidedAt: new Date(row.decided_at),
    notes: row.notes,
    metadata: parseJsonbField(row.metadata),
  };
}

function toDbEventRow(input: CreateOraclePublicationEventInput): DbOraclePublicationEventRow {
  return {
    id: crypto.randomUUID(),
    target_type: input.targetType,
    target_id: input.targetId,
    from_state: input.fromState,
    to_state: input.toState,
    decided_by: input.decidedBy,
    decided_at: nowUtc().toISOString(),
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  };
}

function validateTransition(fromState: OraclePublicationState | null, toState: OraclePublicationState): void {
  if (fromState === toState) {
    throw new Error(`Publication state already ${toState}`);
  }
  const allowedFrom: Record<OraclePublicationState, OraclePublicationState[]> = {
    pending_review: ['approved', 'rejected', 'deferred', 'published'],
    approved: ['published', 'deferred', 'rejected'],
    rejected: ['pending_review', 'deferred'],
    deferred: ['pending_review', 'approved', 'rejected'],
    published: ['deferred', 'rejected'],
  };
  if (fromState && !allowedFrom[fromState].includes(toState)) {
    throw new Error(`Invalid publication transition: ${fromState} -> ${toState}`);
  }
}

export function createOraclePublicationService(db: OraclePublicationDb): OraclePublicationService {
  async function insertEvent(input: CreateOraclePublicationEventInput): Promise<OraclePublicationRecord> {
    const row = await db.insertPublicationEvent(toDbEventRow(input));
    return rowToEvent(row);
  }

  return {
    async decideThesis(thesisId, toState, decidedBy, notes) {
      const fromState = await db.findThesisPublicationStateById(thesisId);
      if (!fromState) throw new Error(`Oracle thesis not found: ${thesisId}`);
      validateTransition(fromState, toState);

      const now = nowUtc().toISOString();
      const publishPatch =
        toState === 'published'
          ? { published_at: now, published_by: decidedBy }
          : { published_at: null, published_by: null };

      await db.updateThesisPublicationState(thesisId, {
        publication_state: toState,
        ...publishPatch,
        last_decision_at: now,
        last_decision_by: decidedBy,
        decision_metadata: JSON.stringify({ notes: notes ?? null, transition: `${fromState}->${toState}` }),
        updated_at: now,
      });

      return insertEvent({
        targetType: 'thesis',
        targetId: thesisId,
        fromState,
        toState,
        decidedBy,
        notes,
      });
    },

    async decideSignal(signalId, toState, decidedBy, notes) {
      const fromState = await db.findSignalPublicationStateById(signalId);
      if (!fromState) throw new Error(`Oracle signal not found: ${signalId}`);
      validateTransition(fromState, toState);

      const now = nowUtc().toISOString();
      const publishPatch =
        toState === 'published'
          ? { published_at: now, published_by: decidedBy }
          : { published_at: null, published_by: null };

      await db.updateSignalPublicationState(signalId, {
        publication_state: toState,
        ...publishPatch,
        publication_notes: notes ?? null,
        updated_at: now,
      });

      return insertEvent({
        targetType: 'signal',
        targetId: signalId,
        fromState,
        toState,
        decidedBy,
        notes,
      });
    },

    async listEvents(targetType) {
      const rows = await db.queryPublicationEvents(targetType);
      return rows.map(rowToEvent);
    },
  };
}

