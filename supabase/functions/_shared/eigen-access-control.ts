import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasMinimumRole } from './roles.ts';
import type { CharterRole } from './rbac.ts';

/** Filter MEG entity ids to those visible to the caller (operator or profile owner). */
export async function filterVisibleMegEntityIds(
  client: SupabaseClient,
  userId: string,
  roles: CharterRole[],
  entityIds: string[],
): Promise<string[]> {
  const ids = entityIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (ids.length === 0) return [];
  if (hasMinimumRole(roles, 'operator')) return ids;

  const checks = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await client.rpc('meg_entity_visible_to_user', {
        p_user_id: userId,
        p_entity_id: id,
      });
      if (error) return null;
      return data === true ? id : null;
    }),
  );
  return checks.filter((id): id is string => id !== null);
}

/** Filter asset_registry ids to those visible to the caller. */
export async function filterVisibleAssetIds(
  client: SupabaseClient,
  userId: string,
  assetIds: string[],
): Promise<string[]> {
  const ids = assetIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (ids.length === 0) return [];

  const checks = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await client.rpc('asset_registry_visible_to_user', {
        p_user_id: userId,
        p_asset_id: id,
      });
      if (error) return null;
      return data === true ? id : null;
    }),
  );
  return checks.filter((id): id is string => id !== null);
}

/** Validate access group exists and is active (service + member ingest paths). */
export async function assertActiveAccessGroup(
  client: SupabaseClient,
  groupId: string,
): Promise<void> {
  const trimmed = groupId.trim();
  if (!trimmed) throw new Error('group_id required');
  const { data, error } = await client
    .from('eigen_access_groups')
    .select('id')
    .eq('id', trimmed)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('group_id: invalid or archived group');
}
