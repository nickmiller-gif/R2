/**
 * Autonomous Capture Service — manages browser-extension-sourced content
 * captures, including AI-generated summaries and Eigen ingest tracking.
 *
 * Follows the R2 service pattern: interface Service + interface Db + factory.
 */

import { nowUtc } from '../../lib/provenance/clock.js';
import type {
  AutonomousCapture,
  AutonomousCaptureFilter,
  CaptureConfidenceLabel,
  CaptureIngestStatus,
  CreateAutonomousCaptureInput,
  UpdateAutonomousCaptureInput,
} from '../../types/eigen/autonomous-capture.js';

export interface DbAutonomousCaptureRow {
  id: string;
  owner_id: string;
  source_url: string;
  page_title: string | null;
  content_fingerprint: string;
  raw_excerpt: string;
  summary: string | null;
  summary_model: string | null;
  confidence_label: string | null;
  session_label: string | null;
  oracle_run_id: string | null;
  charter_decision_id: string | null;
  ingest_status: string;
  ingest_error: string | null;
  ingested_document_id: string | null;
  ingested_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AutonomousCaptureDb {
  insertCapture(row: DbAutonomousCaptureRow): Promise<DbAutonomousCaptureRow>;
  upsertCapture(
    row: DbAutonomousCaptureRow,
    conflictColumns: string[],
  ): Promise<DbAutonomousCaptureRow>;
  findCaptureById(id: string): Promise<DbAutonomousCaptureRow | null>;
  findCaptureByFingerprint(
    ownerId: string,
    fingerprint: string,
  ): Promise<DbAutonomousCaptureRow | null>;
  queryCaptures(filter?: AutonomousCaptureFilter): Promise<DbAutonomousCaptureRow[]>;
  updateCapture(
    id: string,
    patch: Partial<DbAutonomousCaptureRow>,
  ): Promise<DbAutonomousCaptureRow>;
}

export interface AutonomousCaptureService {
  create(input: CreateAutonomousCaptureInput): Promise<AutonomousCapture>;
  upsert(input: CreateAutonomousCaptureInput): Promise<AutonomousCapture>;
  getById(id: string): Promise<AutonomousCapture | null>;
  getByFingerprint(ownerId: string, fingerprint: string): Promise<AutonomousCapture | null>;
  list(filter?: AutonomousCaptureFilter): Promise<AutonomousCapture[]>;
  update(id: string, input: UpdateAutonomousCaptureInput): Promise<AutonomousCapture>;
  markIngested(id: string, documentId: string | null): Promise<AutonomousCapture>;
  markFailed(id: string, error: string): Promise<AutonomousCapture>;
}

function rowToCapture(row: DbAutonomousCaptureRow): AutonomousCapture {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceUrl: row.source_url,
    pageTitle: row.page_title,
    contentFingerprint: row.content_fingerprint,
    rawExcerpt: row.raw_excerpt,
    summary: row.summary,
    summaryModel: row.summary_model,
    confidenceLabel: row.confidence_label as CaptureConfidenceLabel | null,
    sessionLabel: row.session_label,
    oracleRunId: row.oracle_run_id,
    charterDecisionId: row.charter_decision_id,
    ingestStatus: row.ingest_status as CaptureIngestStatus,
    ingestError: row.ingest_error,
    ingestedDocumentId: row.ingested_document_id,
    ingestedAt: row.ingested_at ? new Date(row.ingested_at) : null,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function inputToRow(
  id: string,
  input: CreateAutonomousCaptureInput,
  now: string,
): DbAutonomousCaptureRow {
  return {
    id,
    owner_id: input.ownerId,
    source_url: input.sourceUrl,
    page_title: input.pageTitle ?? null,
    content_fingerprint: input.contentFingerprint,
    raw_excerpt: input.rawExcerpt,
    summary: input.summary ?? null,
    summary_model: input.summaryModel ?? null,
    confidence_label: input.confidenceLabel ?? null,
    session_label: input.sessionLabel ?? null,
    oracle_run_id: input.oracleRunId ?? null,
    charter_decision_id: input.charterDecisionId ?? null,
    ingest_status: 'pending',
    ingest_error: null,
    ingested_document_id: null,
    ingested_at: null,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
  };
}

export function createAutonomousCaptureService(db: AutonomousCaptureDb): AutonomousCaptureService {
  return {
    async create(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertCapture(inputToRow(crypto.randomUUID(), input, now));
      return rowToCapture(row);
    },

    async upsert(input) {
      const now = nowUtc().toISOString();
      const row = await db.upsertCapture(
        inputToRow(crypto.randomUUID(), input, now),
        ['owner_id', 'content_fingerprint'],
      );
      return rowToCapture(row);
    },

    async getById(id) {
      const row = await db.findCaptureById(id);
      return row ? rowToCapture(row) : null;
    },

    async getByFingerprint(ownerId, fingerprint) {
      const row = await db.findCaptureByFingerprint(ownerId, fingerprint);
      return row ? rowToCapture(row) : null;
    },

    async list(filter) {
      const rows = await db.queryCaptures(filter);
      return rows.map(rowToCapture);
    },

    async update(id, input) {
      const now = nowUtc().toISOString();
      const patch: Partial<DbAutonomousCaptureRow> = { updated_at: now };
      if (input.summary !== undefined) patch.summary = input.summary;
      if (input.summaryModel !== undefined) patch.summary_model = input.summaryModel;
      if (input.confidenceLabel !== undefined) patch.confidence_label = input.confidenceLabel;
      if (input.ingestStatus !== undefined) patch.ingest_status = input.ingestStatus;
      if (input.ingestError !== undefined) patch.ingest_error = input.ingestError;
      if (input.ingestedDocumentId !== undefined)
        patch.ingested_document_id = input.ingestedDocumentId;
      if (input.ingestedAt !== undefined)
        patch.ingested_at = input.ingestedAt
          ? new Date(input.ingestedAt).toISOString()
          : null;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      const row = await db.updateCapture(id, patch);
      return rowToCapture(row);
    },

    async markIngested(id, documentId) {
      const now = nowUtc().toISOString();
      const row = await db.updateCapture(id, {
        ingest_status: 'ingested',
        ingest_error: null,
        ingested_document_id: documentId,
        ingested_at: now,
        updated_at: now,
      });
      return rowToCapture(row);
    },

    async markFailed(id, error) {
      const now = nowUtc().toISOString();
      const row = await db.updateCapture(id, {
        ingest_status: 'failed',
        ingest_error: error,
        updated_at: now,
      });
      return rowToCapture(row);
    },
  };
}
