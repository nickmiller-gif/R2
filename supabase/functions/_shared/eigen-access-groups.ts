import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { policyTagEigenxGroup } from '../../../src/lib/eigen/eigen-access-groups.ts';

export { policyTagEigenxGroup } from '../../../src/lib/eigen/eigen-access-groups.ts';

/** Active group UUIDs the user belongs to (for policy scope expansion). */
export async function loadActiveGroupIdsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const members = await client
    .from('eigen_access_group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (members.error) throw new Error(members.error.message);

  const groupIds = (members.data ?? []).map((row) => String(row.group_id));
  if (groupIds.length === 0) return [];

  const groups = await client
    .from('eigen_access_groups')
    .select('id')
    .in('id', groupIds)
    .eq('status', 'active');
  if (groups.error) throw new Error(groups.error.message);

  return (groups.data ?? []).map((row) => String(row.id));
}

export async function isUserMemberOfGroup(
  client: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('eigen_access_group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.group_id);
}

export async function assertUserMemberOfGroup(
  client: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<void> {
  const ok = await isUserMemberOfGroup(client, userId, groupId);
  if (!ok) throw new Error('group_id: not a member of this access group');
}

/** Resolve policy tag for a group (convenience for ingest validation). */
export function groupPolicyTagForId(groupId: string): string {
  return policyTagEigenxGroup(groupId);
}
