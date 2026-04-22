/**
 * Eigen site registry — per-site widget policy and capability hints (KOS-aligned).
 */

export type EigenSiteMode = 'public' | 'eigenx' | 'mixed';
export type EigenSiteStatus = 'active' | 'paused' | 'archived';

export interface EigenSiteRegistry {
  siteId: string;
  displayName: string;
  mode: EigenSiteMode;
  origins: string[];
  sourceSystems: string[];
  defaultPolicyScope: string[];
  status: EigenSiteStatus;
  metadata: Record<string, unknown>;
  policyNotes: string | null;
  capabilityProfile: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EigenSiteRegistryFilter {
  status?: EigenSiteStatus;
  mode?: EigenSiteMode;
}

export interface UpdateEigenSiteRegistryPolicyMetaInput {
  policyNotes?: string | null;
  capabilityProfile?: Record<string, unknown>;
}
