/**
 * Oracle signal service — manages scored assessments produced by Oracle.
 *
 * Oracle reads evidence (documents, market intel) and writes signals.
 * Product domains (Ray's Retreat, etc.) consume signals for reports.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import type {
  OracleSignal,
  CreateOracleSignalInput,
  UpdateOracleSignalInput,
  OracleSignalFilter,
} from '../../types/oracle/signal.js';
import { nowUtc } from '../../lib/provenance/clock.js';

export interface OracleSignalService {
  create(input: CreateOracleSignalInput): Promise<OracleSignal>;
  getById(id: string): Promise<OracleSignal | null>;
  getLatestForEntity(entityAssetId: string): Promise<OracleSignal | null>;
  list(filter?: OracleSignalFilter): Promise<OracleSignal[]>;
  update(id: string, input: UpdateOracleSignalInput): Promise<OracleSignal>;
  /** Re-score: creates a new version and supersedes the previous signal. */
  rescore(previousId: string, input: CreateOracleSignalInput): Promise<OracleSignal>;
}

export interface DbOracleSignalRow {
  id: string;
  entity_asset_id: string;
  score: number;
  confidence: string;
  reasons: string[];
  tags: string[];
  status: string;
  analysis_document_id: string | null;
  source_asset_id: string | null;
  producer_ref: string;
  version: number;
  publication_state: string;
  published_at: string | null;
  published_by: string | null;
  publication_notes: string | null;
  scored_at: string;
  created_at: string;
  updated_at: string;
}

export interface OracleSignalDb {
  insertSignal(row: DbOracleSignalRow): Promise<DbOracleSignalRow>;
  findSignalById(id: string): Promise<DbOracleSignalRow | null>;
  findLatestForEntity(entityAssetId: string): Promise<DbOracleSignalRow | null>;
  querySignals(filter?: OracleSignalFilter): Promise<DbOracleSignalRow[]>;
  updateSignal(id: string, patch: Partial<DbOracleSignalRow>): Promise<DbOracleSignalRow>;
}

function rowToSignal(row: DbOracleSignalRow): OracleSignal {
  return {
    id: row.id,
    entityAssetId: row.entity_asset_id,
    score: row.score,
    confidence: row.confidence as OracleSignal['confidence'],
    reasons: row.reasons,
    tags: row.tags,
    status: row.status as OracleSignal['status'],
    analysisDocumentId: row.analysis_document_id,
    sourceAssetId: row.source_asset_id,
    producerRef: row.producer_ref,
    version: row.version,
    publicationState: row.publication_state as OracleSignal['publicationState'],
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    publishedBy: row.published_by,
    publicationNotes: row.publication_notes,
    scoredAt: new Date(row.scored_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createOracleSignalService(db: OracleSignalDb): OracleSignalService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertSignal({
        id: crypto.randomUUID(),
        entity_asset_id: input.entityAssetId,
        score: input.score,
        confidence: input.confidence,
        reasons: input.reasons,
        tags: input.tags ?? [],
        status: 'scored',
        analysis_document_id: input.analysisDocumentId ?? null,
        source_asset_id: input.sourceAssetId ?? null,
        producer_ref: input.producerRef,
        version: 1,
        publication_state: 'pending_review',
        published_at: null,
        published_by: null,
        publication_notes: null,
        scored_at: now,
        created_at: now,
        updated_at: now,
      });
      return rowToSignal(row);
    },

    async getById(id) {
      const row = await db.findSignalById(id);
      return row ? rowToSignal(row) : null;
    },

    async getLatestForEntity(entityAssetId) {
      const row = await db.findLatestForEntity(entityAssetId);
      return row ? rowToSignal(row) : null;
    },

    async list(filter) {
      const rows = await db.querySignals(filter);
      return rows.map(rowToSignal);
    },

    async update(id, input) {
      const patch: Partial<DbOracleSignalRow> = {
        updated_at: nowUtc().toISOString(),
      };
      if (input.score !== undefined) patch.score = input.score;
      if (input.confidence !== undefined) patch.confidence = input.confidence;
      if (input.reasons !== undefined) patch.reasons = input.reasons;
      if (input.tags !== undefined) patch.tags = input.tags;
      if (input.status !== undefined) patch.status = input.status;
      if (input.publicationState !== undefined) patch.publication_state = input.publicationState;
      if (input.publicationNotes !== undefined) patch.publication_notes = input.publicationNotes;

      const row = await db.updateSignal(id, patch);
      return rowToSignal(row);
    },

    async rescore(previousId, input) {
      const now = nowUtc().toISOString();

      // Supersede the previous signal
      const previous = await db.findSignalById(previousId);
      if (!previous) throw new Error(`Oracle signal not found: ${previousId}`);

      await db.updateSignal(previousId, {
        status: 'superseded',
        updated_at: now,
      });

      // Create the new version
      const row = await db.insertSignal({
        id: crypto.randomUUID(),
        entity_asset_id: input.entityAssetId,
        score: input.score,
        confidence: input.confidence,
        reasons: input.reasons,
        tags: input.tags ?? [],
        status: 'scored',
        analysis_document_id: input.analysisDocumentId ?? null,
        source_asset_id: input.sourceAssetId ?? null,
        producer_ref: input.producerRef,
        version: previous.version + 1,
        publication_state: 'pending_review',
        published_at: null,
        published_by: null,
        publication_notes: null,
        scored_at: now,
        created_at: now,
        updated_at: now,
      });

      return rowToSignal(row);
    },
  };
}
