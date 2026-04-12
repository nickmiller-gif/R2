/**
 * Oracle thesis service — manages thesis statements and their evidence relationships.
 *
 * Theses are structured claims about market/domain conditions, supported by signals
 * and evidence items. They track novelty, validation, and publication state.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleThesis,
  CreateOracleThesisInput,
  UpdateOracleThesisInput,
  OracleThesisFilter,
} from '../../types/oracle/thesis.js';
import type { OracleGovernanceMetadata } from '../../types/oracle/shared.js';
import { nowUtc } from '../../lib/provenance/clock.js';
import { parseJsonbField } from './oracle-db-utils.js';
import { assertConfidence } from '../../lib/charter/validate.js';

const THESIS_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'retired'],
  active: ['challenged', 'superseded', 'retired'],
  challenged: ['active', 'superseded', 'retired'],
  superseded: [],
  retired: [],
};

export interface OracleThesisService {
  create(input: CreateOracleThesisInput): Promise<OracleThesis>;
  getById(id: string): Promise<OracleThesis | null>;
  list(filter?: OracleThesisFilter): Promise<OracleThesis[]>;
  update(id: string, input: UpdateOracleThesisInput): Promise<OracleThesis>;
  publish(id: string, publishedBy: string): Promise<OracleThesis>;
  challenge(id: string): Promise<OracleThesis>;
  supersede(id: string, supersededByThesisId: string): Promise<OracleThesis>;
}

export interface DbOracleThesisRow {
  id: string;
  profile_id: string | null;
  meg_entity_id: string | null;
  title: string;
  thesis_statement: string;
  status: string;
  novelty_status: string;
  duplicate_of_thesis_id: string | null;
  superseded_by_thesis_id: string | null;
  inspiration_signal_ids: string;
  inspiration_evidence_item_ids: string;
  validation_evidence_item_ids: string;
  contradiction_evidence_item_ids: string;
  confidence: number;
  evidence_strength: number;
  uncertainty_summary: string | null;
  publication_state: string;
  published_at: string | null;
  published_by: string | null;
  last_decision_at: string | null;
  last_decision_by: string | null;
  decision_metadata: string;
  metadata: string;
  governance: string;
  created_at: string;
  updated_at: string;
}

export interface OracleThesisDb {
  insertThesis(row: DbOracleThesisRow): Promise<DbOracleThesisRow>;
  findThesisById(id: string): Promise<DbOracleThesisRow | null>;
  queryTheses(filter?: OracleThesisFilter): Promise<DbOracleThesisRow[]>;
  updateThesis(id: string, patch: Partial<DbOracleThesisRow>): Promise<DbOracleThesisRow>;
}

function rowToThesis(row: DbOracleThesisRow): OracleThesis {
  return {
    id: row.id,
    profileId: row.profile_id,
    megEntityId: row.meg_entity_id,
    title: row.title,
    thesisStatement: row.thesis_statement,
    status: row.status as OracleThesis['status'],
    noveltyStatus: row.novelty_status as OracleThesis['noveltyStatus'],
    duplicateOfThesisId: row.duplicate_of_thesis_id,
    supersededByThesisId: row.superseded_by_thesis_id,
    inspirationSignalIds: parseJsonbField(row.inspiration_signal_ids) as unknown as string[],
    inspirationEvidenceItemIds: parseJsonbField(row.inspiration_evidence_item_ids) as unknown as string[],
    validationEvidenceItemIds: parseJsonbField(row.validation_evidence_item_ids) as unknown as string[],
    contradictionEvidenceItemIds: parseJsonbField(row.contradiction_evidence_item_ids) as unknown as string[],
    confidence: row.confidence,
    evidenceStrength: row.evidence_strength,
    uncertaintySummary: row.uncertainty_summary,
    publicationState: row.publication_state as OracleThesis['publicationState'],
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    publishedBy: row.published_by,
    lastDecisionAt: row.last_decision_at ? new Date(row.last_decision_at) : null,
    lastDecisionBy: row.last_decision_by,
    decisionMetadata: parseJsonbField(row.decision_metadata),
    metadata: parseJsonbField(row.metadata),
    governance: parseJsonbField(row.governance) as OracleGovernanceMetadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleThesisService(db: OracleThesisDb): OracleThesisService {
  return {
    async create(input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      const now = nowUtc().toISOString();
      const row = await db.insertThesis({
        id: crypto.randomUUID(),
        profile_id: input.profileId ?? null,
        meg_entity_id: input.megEntityId ?? null,
        title: input.title,
        thesis_statement: input.thesisStatement,
        status: input.status ?? 'draft',
        novelty_status: input.noveltyStatus ?? 'new',
        duplicate_of_thesis_id: null,
        superseded_by_thesis_id: null,
        inspiration_signal_ids: JSON.stringify([]),
        inspiration_evidence_item_ids: JSON.stringify([]),
        validation_evidence_item_ids: JSON.stringify([]),
        contradiction_evidence_item_ids: JSON.stringify([]),
        confidence: input.confidence ?? 50,
        evidence_strength: input.evidenceStrength ?? 0,
        uncertainty_summary: input.uncertaintySummary ?? null,
        publication_state: 'pending_review',
        published_at: null,
        published_by: null,
        last_decision_at: null,
        last_decision_by: null,
        decision_metadata: JSON.stringify({}),
        metadata: JSON.stringify(input.metadata ?? {}),
        governance: JSON.stringify(input.governance ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToThesis(row);
    },

    async getById(id) {
      const row = await db.findThesisById(id);
      return row ? rowToThesis(row) : null;
    },

    async list(filter) {
      const limit = Math.min(filter?.limit ?? 50, 1000);
      const offset = filter?.offset ?? 0;
      const rows = await db.queryTheses({ ...filter, limit, offset });
      return rows.map(rowToThesis);
    },

    async update(id, input) {
      if (input.confidence !== undefined) assertConfidence(input.confidence);
      if (input.status !== undefined) {
        const current = await db.findThesisById(id);
        if (!current) throw new Error(`OracleThesis not found: ${id}`);
        const allowed = THESIS_STATUS_TRANSITIONS[current.status] ?? [];
        if (!allowed.includes(input.status)) {
          throw new Error(
            `Invalid status transition: '${current.status}' → '${input.status}'`,
          );
        }
      }
      const now = nowUtc().toISOString();
      const patch: Partial<DbOracleThesisRow> = {
        updated_at: now,
      };
      if (input.title !== undefined) patch.title = input.title;
      if (input.thesisStatement !== undefined) patch.thesis_statement = input.thesisStatement;
      if (input.megEntityId !== undefined) patch.meg_entity_id = input.megEntityId;
      if (input.status !== undefined) patch.status = input.status;
      if (input.noveltyStatus !== undefined) patch.novelty_status = input.noveltyStatus;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.evidenceStrength !== undefined) patch.evidence_strength = input.evidenceStrength;
      if (input.uncertaintySummary !== undefined) patch.uncertainty_summary = input.uncertaintySummary;
      if (input.publicationState !== undefined) patch.publication_state = input.publicationState;
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);

      const row = await db.updateThesis(id, patch);
      return rowToThesis(row);
    },

    async publish(id, publishedBy) {
      const now = nowUtc().toISOString();
      const row = await db.updateThesis(id, {
        publication_state: 'published',
        published_at: now,
        published_by: publishedBy,
        updated_at: now,
      });
      return rowToThesis(row);
    },

    async challenge(id) {
      const now = nowUtc().toISOString();
      const row = await db.updateThesis(id, {
        status: 'challenged',
        updated_at: now,
      });
      return rowToThesis(row);
    },

    async supersede(id, supersededByThesisId) {
      const now = nowUtc().toISOString();
      const row = await db.updateThesis(id, {
        status: 'superseded',
        superseded_by_thesis_id: supersededByThesisId,
        updated_at: now,
      });
      return rowToThesis(row);
    },
  };
}
