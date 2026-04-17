/**
 * Oracle publication workflow types.
 */
import type { OraclePublicationState } from './shared.ts';

export type OraclePublicationDecision = 'approve' | 'reject' | 'defer' | 'publish' | 'withdraw';

export interface OraclePublicationRecord {
  id: string;
  targetType: 'thesis' | 'signal';
  targetId: string;
  fromState: OraclePublicationState | null;
  toState: OraclePublicationState;
  decidedBy: string;
  decidedAt: Date;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateOraclePublicationEventInput {
  targetType: OraclePublicationRecord['targetType'];
  targetId: string;
  fromState: OraclePublicationState | null;
  toState: OraclePublicationState;
  decidedBy: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

