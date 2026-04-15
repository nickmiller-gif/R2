/**
 * Autonomous Capture — browser-extension-sourced content captures with
 * AI summarization and Eigen ingest.
 */

export type CaptureConfidenceLabel = 'low' | 'medium' | 'high';
export type CaptureIngestStatus = 'pending' | 'ingested' | 'failed';

export interface AutonomousCapture {
  id: string;
  ownerId: string;
  sourceUrl: string;
  pageTitle: string | null;
  contentFingerprint: string;
  rawExcerpt: string;
  summary: string | null;
  summaryModel: string | null;
  confidenceLabel: CaptureConfidenceLabel | null;
  sessionLabel: string | null;
  oracleRunId: string | null;
  charterDecisionId: string | null;
  ingestStatus: CaptureIngestStatus;
  ingestError: string | null;
  ingestedDocumentId: string | null;
  ingestedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAutonomousCaptureInput {
  ownerId: string;
  sourceUrl: string;
  pageTitle?: string | null;
  contentFingerprint: string;
  rawExcerpt: string;
  summary?: string | null;
  summaryModel?: string | null;
  confidenceLabel?: CaptureConfidenceLabel | null;
  sessionLabel?: string | null;
  oracleRunId?: string | null;
  charterDecisionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateAutonomousCaptureInput {
  summary?: string | null;
  summaryModel?: string | null;
  confidenceLabel?: CaptureConfidenceLabel | null;
  ingestStatus?: CaptureIngestStatus;
  ingestError?: string | null;
  ingestedDocumentId?: string | null;
  ingestedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AutonomousCaptureFilter {
  ownerId?: string;
  ingestStatus?: CaptureIngestStatus;
  sessionLabel?: string;
}
