/**
 * R2 Charter — Full domain types.
 * Mirrors the charter_* Postgres schema with R2-convention camelCase domain objects.
 */

// ─── Enums / Union Types ───────────────────────────────────────

export type CharterRole = 'member' | 'reviewer' | 'operator' | 'counsel' | 'admin';

/** Aligned with MEG meg_entity_type (including IP and abstract nodes). */
export type EntityType =
  | 'person'
  | 'org'
  | 'property'
  | 'product'
  | 'concept'
  | 'location'
  | 'ip';

/** Valuation basis for a MEG-classified asset (Charter economic / governance layer). */
export type CharterValuationKind =
  | 'market'
  | 'book'
  | 'insurance'
  | 'replacement'
  | 'liquidation'
  | 'income_approach'
  | 'charter_basis'
  | 'tax_assessment'
  | 'custom';

export type CharterValuationStatus = 'draft' | 'active' | 'superseded';
export type EntityStatus = 'draft' | 'active' | 'archived';
export type CharterContextStatus = 'unlinked' | 'linked' | 'stale' | 'error';

export type RightType = 'nil' | 'license' | 'lease' | 'approval';
export type RightStatus = 'pending' | 'active' | 'expired' | 'revoked';

export type ObligationType = 'payment' | 'filing' | 'compliance' | 'delivery';
export type ObligationStatus = 'pending' | 'fulfilled' | 'overdue' | 'waived';

export type EvidenceType = 'document' | 'photo' | 'filing' | 'testimony';
export type EvidenceStatus = 'submitted' | 'verified' | 'challenged';
export type EvidenceLinkedTable =
  | 'entities'
  | 'rights'
  | 'obligations'
  | 'payouts'
  | 'decisions'
  | 'ip_matters'
  | 'asset_valuations';

export type PayoutStatus = 'pending' | 'approved' | 'disbursed' | 'rejected';

export type DecisionType = 'approval' | 'rejection' | 'escalation' | 'override';
export type DecisionStatus = 'pending' | 'final' | 'appealed';
export type DecisionLinkedTable =
  | 'entities'
  | 'rights'
  | 'obligations'
  | 'payouts'
  | 'evidence'
  | 'ip_matters'
  | 'asset_valuations';

export type AuditAction = 'create' | 'update' | 'delete' | 'status_change';

// ─── Domain Objects (camelCase, R2 convention) ─────────────────

export interface CharterEntity {
  id: string;
  entityType: EntityType;
  name: string;
  metadata: Record<string, unknown>;
  status: EntityStatus;
  confidence: number;
  createdBy: string;
  reviewedBy: string | null;
  canonicalEntityId: string | null;
  sourcePlatform: string | null;
  sourceRecordId: string | null;
  contextStatus: CharterContextStatus;
  lastContextSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharterRight {
  id: string;
  entityId: string;
  rightType: RightType;
  title: string;
  description: string | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  status: RightStatus;
  confidence: number;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharterObligation {
  id: string;
  entityId: string;
  rightId: string | null;
  obligationType: ObligationType;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: ObligationStatus;
  confidence: number;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharterEvidence {
  id: string;
  linkedTable: EvidenceLinkedTable;
  linkedId: string;
  evidenceType: EvidenceType;
  title: string;
  storagePath: string | null;
  metadata: Record<string, unknown>;
  status: EvidenceStatus;
  confidence: number;
  createdBy: string;
  reviewedBy: string | null;
  canonicalEntityId: string | null;
  provenanceRecordId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharterPayout {
  id: string;
  entityId: string;
  rightId: string | null;
  obligationId: string | null;
  amount: number;
  currency: string;
  payoutDate: Date | null;
  status: PayoutStatus;
  approvedBy: string | null;
  confidence: number;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharterDecision {
  id: string;
  linkedTable: DecisionLinkedTable;
  linkedId: string;
  decisionType: DecisionType;
  title: string;
  rationale: string | null;
  outcome: Record<string, unknown>;
  decidedBy: string | null;
  decidedAt: Date | null;
  status: DecisionStatus;
  confidence: number;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Recorded value of an asset; megEntityId is the canonical subject (MEG classification). */
export interface CharterAssetValuation {
  id: string;
  megEntityId: string;
  charterEntityId: string | null;
  valuationKind: CharterValuationKind;
  amountNumeric: string;
  currency: string;
  asOf: Date;
  confidence: number;
  methodology: string | null;
  basisNotes: string | null;
  metadata: Record<string, unknown>;
  status: CharterValuationStatus;
  supersedesId: string | null;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharterAssetValuationInput {
  megEntityId: string;
  charterEntityId?: string | null;
  valuationKind: CharterValuationKind;
  amountNumeric: string;
  currency?: string;
  asOf: string;
  methodology?: string | null;
  basisNotes?: string | null;
  metadata?: Record<string, unknown>;
  status?: CharterValuationStatus;
  supersedesId?: string | null;
  confidence?: number;
  /** Required when status is active (governance review). */
  reviewedBy?: string | null;
  createdBy: string;
}

export interface UpdateCharterAssetValuationInput {
  charterEntityId?: string | null;
  valuationKind?: CharterValuationKind;
  amountNumeric?: string;
  currency?: string;
  asOf?: string;
  methodology?: string | null;
  basisNotes?: string | null;
  metadata?: Record<string, unknown>;
  status?: CharterValuationStatus;
  supersedesId?: string | null;
  confidence?: number;
  reviewedBy?: string | null;
}

export interface CharterAssetValuationFilter {
  megEntityId?: string;
  charterEntityId?: string;
  valuationKind?: CharterValuationKind;
  status?: CharterValuationStatus;
  limit?: number;
  offset?: number;
}

export interface CharterAuditEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  performedBy: string;
  performedAt: Date;
}

export interface CharterUserRole {
  id: string;
  userId: string;
  role: CharterRole;
  assignedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Input Types ───────────────────────────────────────────────

export interface CreateCharterRightInput {
  entityId: string;
  rightType: RightType;
  title: string;
  description?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  status?: RightStatus;
  confidence?: number;
  createdBy: string;
}

export interface UpdateCharterRightInput {
  rightType?: RightType;
  title?: string;
  description?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  status?: RightStatus;
  confidence?: number;
  reviewedBy?: string | null;
}

export interface CreateCharterObligationInput {
  entityId: string;
  rightId?: string | null;
  obligationType: ObligationType;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status?: ObligationStatus;
  confidence?: number;
  createdBy: string;
}

export interface UpdateCharterObligationInput {
  obligationType?: ObligationType;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  status?: ObligationStatus;
  confidence?: number;
  reviewedBy?: string | null;
}

export interface CreateCharterEvidenceInput {
  linkedTable: EvidenceLinkedTable;
  linkedId: string;
  evidenceType: EvidenceType;
  title: string;
  storagePath?: string | null;
  metadata?: Record<string, unknown>;
  status?: EvidenceStatus;
  confidence?: number;
  createdBy: string;
  canonicalEntityId?: string | null;
  provenanceRecordId?: string | null;
}

export interface UpdateCharterEvidenceInput {
  evidenceType?: EvidenceType;
  title?: string;
  storagePath?: string | null;
  metadata?: Record<string, unknown>;
  status?: EvidenceStatus;
  confidence?: number;
  reviewedBy?: string | null;
}

export interface CreateCharterPayoutInput {
  entityId: string;
  rightId?: string | null;
  obligationId?: string | null;
  amount: number;
  currency: string;
  payoutDate?: string | null;
  status?: PayoutStatus;
  confidence?: number;
  createdBy: string;
}

export interface UpdateCharterPayoutInput {
  amount?: number;
  currency?: string;
  payoutDate?: string | null;
  status?: PayoutStatus;
  approvedBy?: string | null;
  confidence?: number;
  reviewedBy?: string | null;
}

export interface CreateCharterDecisionInput {
  linkedTable: DecisionLinkedTable;
  linkedId: string;
  decisionType: DecisionType;
  title: string;
  rationale?: string | null;
  outcome?: Record<string, unknown>;
  decidedBy?: string | null;
  decidedAt?: string | null;
  status?: DecisionStatus;
  confidence?: number;
  createdBy: string;
}

export interface UpdateCharterDecisionInput {
  decisionType?: DecisionType;
  title?: string;
  rationale?: string | null;
  outcome?: Record<string, unknown>;
  decidedBy?: string | null;
  decidedAt?: string | null;
  status?: DecisionStatus;
  confidence?: number;
  reviewedBy?: string | null;
}

export interface AssignCharterRoleInput {
  userId: string;
  role: CharterRole;
  assignedBy: string;
}

// ─── Filter Types ──────────────────────────────────────────────

export interface CharterRightFilter {
  entityId?: string;
  rightType?: RightType;
  status?: RightStatus;
  limit?: number;
  offset?: number;
}

export interface CharterObligationFilter {
  entityId?: string;
  rightId?: string;
  obligationType?: ObligationType;
  status?: ObligationStatus;
  limit?: number;
  offset?: number;
}

export interface CharterEvidenceFilter {
  linkedTable?: EvidenceLinkedTable;
  linkedId?: string;
  evidenceType?: EvidenceType;
  status?: EvidenceStatus;
  limit?: number;
  offset?: number;
}

export interface CharterPayoutFilter {
  entityId?: string;
  rightId?: string;
  obligationId?: string;
  status?: PayoutStatus;
  limit?: number;
  offset?: number;
}

export interface CharterDecisionFilter {
  linkedTable?: DecisionLinkedTable;
  linkedId?: string;
  decisionType?: DecisionType;
  status?: DecisionStatus;
  limit?: number;
  offset?: number;
}

export interface CharterUserRoleFilter {
  userId?: string;
  role?: CharterRole;
  limit?: number;
  offset?: number;
}
