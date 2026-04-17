/**
 * Oracle thesis-evidence link service — manages relationships between theses and evidence.
 *
 * Links track how evidence items support (inspiration/validation) or challenge
 * (contradiction) a thesis. Weighted edges allow for evidence strength calibration.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleThesisEvidenceLink,
  CreateThesisEvidenceLinkInput,
} from '../../types/oracle/thesis-evidence-link.ts';
import { nowUtc } from '../../lib/provenance/clock.ts';

export interface OracleThesisEvidenceLinkService {
  create(input: CreateThesisEvidenceLinkInput): Promise<OracleThesisEvidenceLink>;
  listForThesis(thesisId: string): Promise<OracleThesisEvidenceLink[]>;
  listForEvidence(evidenceItemId: string): Promise<OracleThesisEvidenceLink[]>;
  remove(thesisId: string, evidenceItemId: string, role: string): Promise<void>;
}

export interface DbOracleThesisEvidenceLinkRow {
  id: string;
  thesis_id: string;
  evidence_item_id: string;
  role: string;
  weight: number;
  notes: string | null;
  created_at: string;
}

export interface OracleThesisEvidenceLinkDb {
  insertLink(row: DbOracleThesisEvidenceLinkRow): Promise<DbOracleThesisEvidenceLinkRow>;
  findLinksForThesis(thesisId: string): Promise<DbOracleThesisEvidenceLinkRow[]>;
  findLinksForEvidence(evidenceItemId: string): Promise<DbOracleThesisEvidenceLinkRow[]>;
  deleteLink(thesisId: string, evidenceItemId: string, role: string): Promise<void>;
}

function rowToLink(row: DbOracleThesisEvidenceLinkRow): OracleThesisEvidenceLink {
  return {
    id: row.id,
    thesisId: row.thesis_id,
    evidenceItemId: row.evidence_item_id,
    role: row.role as OracleThesisEvidenceLink['role'],
    weight: row.weight,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  };
}

export function createOracleThesisEvidenceLinkService(
  db: OracleThesisEvidenceLinkDb
): OracleThesisEvidenceLinkService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertLink({
        id: crypto.randomUUID(),
        thesis_id: input.thesisId,
        evidence_item_id: input.evidenceItemId,
        role: input.role,
        weight: input.weight ?? 1.0,
        notes: input.notes ?? null,
        created_at: now,
      });
      return rowToLink(row);
    },

    async listForThesis(thesisId) {
      const rows = await db.findLinksForThesis(thesisId);
      return rows.map(rowToLink);
    },

    async listForEvidence(evidenceItemId) {
      const rows = await db.findLinksForEvidence(evidenceItemId);
      return rows.map(rowToLink);
    },

    async remove(thesisId, evidenceItemId, role) {
      await db.deleteLink(thesisId, evidenceItemId, role);
    },
  };
}
