/**
 * Asset registry + evidence links — the entity graph primitives
 * that connect ideas, documents, signals, and governance entities
 * into an auditable evidence graph.
 *
 * Per CentralR2: avoids per-table governance drift by providing
 * a canonical registry for anything that needs linking.
 */

export type AssetKind =
  | 'idea_submission'
  | 'document'
  | 'oracle_signal'
  | 'governance_entity'
  | 'work'
  | 'contract'
  | 'account'
  | 'project';

export interface AssetRegistryEntry {
  id: string;
  /** The kind of asset. */
  kind: AssetKind;
  /** Reference to the domain-specific record (e.g., idea_submission.id, document.id). */
  refId: string;
  /** Domain that owns this asset (e.g., 'rays_retreat', 'charter', 'oracle'). */
  domain: string;
  /** Human-readable label. */
  label: string;
  /** Optional metadata bag. */
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type EvidenceLinkKind =
  | 'supports'
  | 'contradicts'
  | 'derived_from'
  | 'references'
  | 'supersedes'
  | 'scored_by';

export interface AssetEvidenceLink {
  id: string;
  /** Source asset in the evidence relationship. */
  fromAssetId: string;
  /** Target asset in the evidence relationship. */
  toAssetId: string;
  /** Nature of the relationship. */
  linkKind: EvidenceLinkKind;
  /** Confidence in this link (0.0–1.0, null if not assessed). */
  confidence: number | null;
  /** Optional metadata (e.g., reason, extraction method). */
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAssetRegistryInput {
  kind: AssetKind;
  refId: string;
  domain: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface CreateEvidenceLinkInput {
  fromAssetId: string;
  toAssetId: string;
  linkKind: EvidenceLinkKind;
  confidence?: number;
  metadata?: Record<string, unknown>;
}
