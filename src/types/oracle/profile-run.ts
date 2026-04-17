/**
 * Oracle profile-run types — represents one execution of the Oracle
 * analysis pipeline for a given entity.
 *
 * Status lifecycle mirrors OracleProfileRunStatus from shared.ts:
 *   queued → running → completed | failed | canceled
 */

import type { OracleProfileRunStatus } from './shared.ts';

export interface OracleProfileRun {
  id: string;
  entityAssetId: string;
  status: OracleProfileRunStatus;
  triggeredBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  signalCount: number;
  topScore: number | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleProfileRunInput {
  entityAssetId: string;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
}

export interface CompleteOracleProfileRunInput {
  signalCount: number;
  topScore: number | null;
  summary?: string;
}

export interface OracleProfileRunFilter {
  entityAssetId?: string;
  status?: OracleProfileRunStatus;
  triggeredBy?: string;
}
