/**
 * Oracle Source Pack — curated source bundles for analyzer profiles.
 */
import type {
  OracleGovernanceMetadata,
  OracleSourceLane,
  OracleSourceClass,
} from './shared.js';

export interface OracleSourcePack {
  id: string;
  profileId: string | null;
  name: string;
  sourceLane: OracleSourceLane;
  sourceClass: OracleSourceClass;
  sourceScope: string | null;
  sourceIds: string[];
  notes: string | null;
  governance: OracleGovernanceMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOracleSourcePackInput {
  profileId?: string | null;
  name: string;
  sourceLane: OracleSourceLane;
  sourceClass: OracleSourceClass;
  sourceScope?: string | null;
  sourceIds?: string[];
  notes?: string | null;
  governance?: OracleGovernanceMetadata;
}

export interface OracleSourcePackFilter {
  profileId?: string;
  sourceLane?: OracleSourceLane;
  sourceClass?: OracleSourceClass;
}
