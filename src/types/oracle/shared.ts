/**
 * Oracle shared types — enums, base interfaces, vocabulary.
 */

// Source lane = routing/origin channel for processing posture.
export type OracleSourceLane =
  | 'internal_canonical'
  | 'external_authoritative'
  | 'external_perspective'
  | 'federated_openai_vector'
  | 'narrative_context_scenario';

// Source class = provenance/trust semantics for policy/scoring.
export type OracleSourceClass =
  | 'internal_canonical'
  | 'external_authoritative'
  | 'external_analysis_context'
  | 'federated_openai_vector'
  | 'narrative_context_scenario';

export type OracleVisibilityClass = 'private' | 'team' | 'org' | 'restricted';

export type OracleThesisStatus = 'draft' | 'active' | 'challenged' | 'superseded' | 'retired';

export type OracleNoveltyStatus =
  | 'new'
  | 'known'
  | 'duplicate'
  | 'near_duplicate'
  | 'updated_existing';

// Mirrors the `oracle_publication_state` Postgres enum. `superseded` /
// `successor_of` were added to the DB in migration 202604240001 (target_types
// rollout) but were missing from the TS union until now, so callers using this
// type could not express the full state machine.
export type OraclePublicationState =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'deferred'
  | 'published'
  | 'superseded'
  | 'successor_of';

export type OracleProfileRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export type OracleOutcomeType =
  | 'thesis_created'
  | 'thesis_updated'
  | 'thesis_linked'
  | 'theme_update'
  | 'no_change';

export type OracleThesisEvidenceRole = 'inspiration' | 'validation' | 'contradiction';

export type OracleFingerprintType = 'deterministic' | 'semantic';

export interface OracleAccessPolicyRef {
  policyId?: string;
  policyVersion?: string;
  notes?: string;
}

export interface OracleGovernanceMetadata {
  platformId?: string;
  siteDomain?: string;
  visibilityClass?: OracleVisibilityClass;
  accessPolicy?: OracleAccessPolicyRef | string;
}
