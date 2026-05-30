/**
 * EigenX access groups — shared policy scope for members (eigenx:group:<uuid>).
 */

export type EigenAccessGroupStatus = 'active' | 'archived';
export type EigenAccessGroupMemberRole = 'member' | 'admin';

export interface EigenAccessGroup {
  id: string;
  slug: string;
  label: string;
  status: EigenAccessGroupStatus;
  metadata: Record<string, unknown>;
  policyTag: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EigenAccessGroupMembership {
  groupId: string;
  userId: string;
  role: EigenAccessGroupMemberRole;
  joinedAt: Date;
}

export interface EigenAccessGroupWithMembership extends EigenAccessGroup {
  membership: Pick<EigenAccessGroupMembership, 'role' | 'joinedAt'> | null;
}

export interface CreateEigenAccessGroupInput {
  label: string;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface AddEigenAccessGroupMemberInput {
  groupId: string;
  userId: string;
  role?: EigenAccessGroupMemberRole;
}

export interface RemoveEigenAccessGroupMemberInput {
  groupId: string;
  userId: string;
}
