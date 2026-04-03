export interface StageFailure {
  stage: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export type StageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: StageFailure };

export function stageOk<T>(data: T): StageResult<T> {
  return { ok: true, data };
}

export function stageErr(
  stage: string,
  code: string,
  message: string,
  retryable: boolean,
  details?: unknown,
): StageResult<never> {
  return {
    ok: false,
    error: { stage, code, message, retryable, details },
  };
}

export interface ThesisSnapshot {
  id: string;
  profile_id: string;
  title: string;
  thesis_statement: string;
  confidence: number;
  evidence_strength: number;
  validation_evidence_item_ids: unknown;
  contradiction_evidence_item_ids: unknown;
  metadata: Record<string, unknown> | null;
}

export interface ClusteredSignal {
  thesisId: string;
  profileId: string;
  title: string;
  buyer: string;
  offer: string;
  channel: string;
  confidenceThesis: number;
  evidenceStrength: number;
  validationCount: number;
  contradictionCount: number;
}

export interface WhitespaceFrame {
  thesisId: string;
  profileId: string;
  title: string;
  buyer: string;
  offer: string;
  channel: string;
  whitespaceScore: number;
  evidenceSupportScore: number;
  contradictionRatio: number;
}

export interface ScoredWhitespaceFrame extends WhitespaceFrame {
  confidenceEconomics: number;
  confidenceTiming: number;
  downgradeReason: string | null;
}

export interface OpportunityDraft {
  profile_id: string;
  thesis_id: string;
  title: string;
  buyer: string;
  offer: string;
  pricing_model: string;
  estimated_acv_or_ltv: number | null;
  channel: string;
  time_to_first_revenue: string;
  proof_required: string;
  evidence_support_score: number;
  confidence_thesis: number;
  confidence_economics: number;
  confidence_timing: number;
  status: string;
  linked_evidence_ids: string[];
  metadata: Record<string, unknown>;
}
