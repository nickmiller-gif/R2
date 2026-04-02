/**
 * Oracle evidence item service — manages discrete evidence pieces.
 *
 * Evidence items are references to sources (documents, articles, signals) that
 * support or contradict oracle theses. They track source lane, confidence, and role.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleEvidenceItem,
  CreateOracleEvidenceItemInput,
  UpdateOracleEvidenceItemInput,
  OracleEvidenceItemFilter,
} from '../../types/oracle/evidence-item.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface OracleEvidenceItemService {
  create(input: CreateOracleEvidenceItemInput): Promise<OracleEvidenceItem>;
  getById(id: string): Promise<OracleEvidenceItem | null>;
  list(filter?: OracleEvidenceItemFilter): Promise<OracleEvidenceItem[]>;
  update(id: string, input: UpdateOracleEvidenceItemInput): Promise<OracleEvidenceItem>;
}

export interface DbOracleEvidenceItemRow {
  id: string;
  signal_id: string | null;
  claim_id: string | null;
  source_lane: string;
  source_class: string;
  citation_ref: string | null;
  excerpt: string | null;
  confidence: number;
  evidence_strength: number;
  uncertainty_summary: string | null;
  metadata: string;
  governance: string;
  created_at: string;
  updated_at: string;
}

export interface OracleEvidenceItemDb {
  insertEvidenceItem(row: DbOracleEvidenceItemRow): Promise<DbOracleEvidenceItemRow>;
  findEvidenceItemById(id: string): Promise<DbOracleEvidenceItemRow | null>;
  queryEvidenceItems(filter?: OracleEvidenceItemFilter): Promise<DbOracleEvidenceItemRow[]>;
  updateEvidenceItem(
    id: string,
    patch: Partial<DbOracleEvidenceItemRow>
  ): Promise<DbOracleEvidenceItemRow>;
}

function rowToEvidenceItem(row: DbOracleEvidenceItemRow): OracleEvidenceItem {
  return {
    id: row.id,
    signalId: row.signal_id,
    claimId: row.claim_id,
    sourceLane: row.source_lane as OracleEvidenceItem['sourceLane'],
    sourceClass: row.source_class as OracleEvidenceItem['sourceClass'],
    citationRef: row.citation_ref,
    excerpt: row.excerpt,
    confidence: row.confidence,
    evidenceStrength: row.evidence_strength,
    uncertaintySummary: row.uncertainty_summary,
    metadata: JSON.parse(row.metadata),
    governance: JSON.parse(row.governance),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleEvidenceItemService(
  db: OracleEvidenceItemDb
): OracleEvidenceItemService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertEvidenceItem({
        id: crypto.randomUUID(),
        signal_id: input.signalId ?? null,
        claim_id: input.claimId ?? null,
        source_lane: input.sourceLane,
        source_class: input.sourceClass,
        citation_ref: input.citationRef ?? null,
        excerpt: input.excerpt ?? null,
        confidence: input.confidence ?? 50,
        evidence_strength: input.evidenceStrength ?? 0,
        uncertainty_summary: null,
        metadata: JSON.stringify(input.metadata ?? {}),
        governance: JSON.stringify(input.governance ?? {}),
        created_at: now,
        updated_at: now,
      });
      return rowToEvidenceItem(row);
    },

    async getById(id) {
      const row = await db.findEvidenceItemById(id);
      return row ? rowToEvidenceItem(row) : null;
    },

    async list(filter) {
      const rows = await db.queryEvidenceItems(filter);
      return rows.map(rowToEvidenceItem);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbOracleEvidenceItemRow> = {
        updated_at: now,
      };
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.evidenceStrength !== undefined) patch.evidence_strength = input.evidenceStrength;
      if (input.uncertaintySummary !== undefined) patch.uncertainty_summary = input.uncertaintySummary;
      if (input.metadata !== undefined) patch.metadata = JSON.stringify(input.metadata);

      const row = await db.updateEvidenceItem(id, patch);
      return rowToEvidenceItem(row);
    },
  };
}
