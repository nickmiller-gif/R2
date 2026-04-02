/**
 * EigenX Retrieval Run — telemetry for retrieval operations.
 */
export type RetrievalRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RetrievalRun {
  id: string;
  queryHash: string;
  decomposition: Record<string, unknown>;
  candidateCount: number;
  filteredCount: number;
  finalCount: number;
  budgetProfile: Record<string, unknown>;
  droppedContextReasons: string[];
  latencyMs: number;
  status: RetrievalRunStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateRetrievalRunInput {
  queryHash: string;
  decomposition?: Record<string, unknown>;
  budgetProfile?: Record<string, unknown>;
}

export interface RetrievalRunFilter {
  status?: RetrievalRunStatus;
  minLatency?: number;
  maxLatency?: number;
}
