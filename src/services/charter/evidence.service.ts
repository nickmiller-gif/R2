import type {
  CharterEvidence,
  CreateCharterEvidenceInput,
  UpdateCharterEvidenceInput,
  CharterEvidenceFilter,
} from '../../types/charter/types.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { assertConfidence } from '../../lib/charter/validate.js';
import { withPagination } from '../../lib/service-utils/pagination.js';

// ─── Service interfaces ────────────────────────────────────────────────────

export interface CharterEvidenceService {
  create(input: CreateCharterEvidenceInput): Promise<CharterEvidence>;
  getById(id: string): Promise<CharterEvidence | null>;
  list(filter?: CharterEvidenceFilter): Promise<CharterEvidence[]>;
  update(id: string, input: UpdateCharterEvidenceInput): Promise<CharterEvidence>;
}

export interface CharterEvidenceDb {
  insertEvidence(row: DbCharterEvidenceRow): Promise<DbCharterEvidenceRow>;
  findEvidenceById(id: string): Promise<DbCharterEvidenceRow | null>;
  queryEvidence(filter?: CharterEvidenceFilter): Promise<DbCharterEvidenceRow[]>;
  updateEvidence(id: string, patch: Partial<DbCharterEvidenceRow>): Promise<DbCharterEvidenceRow>;
}

export interface DbCharterEvidenceRow {
  id: string;
  linked_table: string;
  linked_id: string;
  evidence_type: string;
  title: string;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  status: string;
  confidence: number;
  created_by: string;
  reviewed_by: string | null;
  canonical_entity_id: string | null;
  provenance_record_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEvidence(row: DbCharterEvidenceRow): CharterEvidence {
  return {
    id: row.id,
    linkedTable: row.linked_table as CharterEvidence['linkedTable'],
    linkedId: row.linked_id,
    evidenceType: row.evidence_type as CharterEvidence['evidenceType'],
    title: row.title,
    storagePath: row.storage_path,
    metadata: row.metadata,
    status: row.status as CharterEvidence['status'],
    confidence: row.confidence,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    canonicalEntityId: row.canonical_entity_id,
    provenanceRecordId: row.provenance_record_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createCharterEvidenceService(db: CharterEvidenceDb): CharterEvidenceService {
  return {
    async create(input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const now = nowUtc().toISOString();
      const row = await db.insertEvidence({
        id: crypto.randomUUID(),
        linked_table: input.linkedTable,
        linked_id: input.linkedId,
        evidence_type: input.evidenceType,
        title: input.title,
        storage_path: input.storagePath ?? null,
        metadata: input.metadata ?? {},
        status: input.status ?? 'submitted',
        confidence: input.confidence ?? 50,
        created_by: input.createdBy,
        reviewed_by: null,
        canonical_entity_id: input.canonicalEntityId ?? null,
        provenance_record_id: input.provenanceRecordId ?? null,
        created_at: now,
        updated_at: now,
      });
      return rowToEvidence(row);
    },

    async getById(id) {
      const row = await db.findEvidenceById(id);
      return row ? rowToEvidence(row) : null;
    },

    async list(filter) {
      const rows = await db.queryEvidence(withPagination(filter));
      return rows.map(rowToEvidence);
    },

    async update(id, input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const patch: Partial<DbCharterEvidenceRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.evidenceType !== undefined) patch.evidence_type = input.evidenceType;
      if (input.title !== undefined) patch.title = input.title;
      if (input.storagePath !== undefined) patch.storage_path = input.storagePath;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      if (input.status !== undefined) patch.status = input.status;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;
      const row = await db.updateEvidence(id, patch);
      return rowToEvidence(row);
    },
  };
}
