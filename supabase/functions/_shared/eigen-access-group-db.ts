import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  DbEigenAccessGroupMemberRow,
  DbEigenAccessGroupRow,
  EigenAccessGroupDb,
  EigenAccessGroupMemberRole,
} from '../../../src/services/eigen/access-group.service.ts';

export function createEigenAccessGroupDb(client: SupabaseClient): EigenAccessGroupDb {
  return {
    async listAllGroups() {
      const { data, error } = await client
        .from('eigen_access_groups')
        .select('id, slug, label, status, metadata, created_at, updated_at')
        .order('label');
      if (error) throw new Error(error.message);
      return (data ?? []) as DbEigenAccessGroupRow[];
    },

    async listGroupsByIds(groupIds, status = 'active') {
      const { data, error } = await client
        .from('eigen_access_groups')
        .select('id, slug, label, status, metadata, created_at, updated_at')
        .in('id', groupIds)
        .eq('status', status);
      if (error) throw new Error(error.message);
      return (data ?? []) as DbEigenAccessGroupRow[];
    },

    async getGroupById(groupId) {
      const { data, error } = await client
        .from('eigen_access_groups')
        .select('id, slug, label, status, metadata, created_at, updated_at')
        .eq('id', groupId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as DbEigenAccessGroupRow | null) ?? null;
    },

    async listMembershipsForUser(userId) {
      const { data, error } = await client
        .from('eigen_access_group_members')
        .select('group_id, user_id, role, joined_at')
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      return (data ?? []) as DbEigenAccessGroupMemberRow[];
    },

    async insertGroup(row) {
      const { data, error } = await client
        .from('eigen_access_groups')
        .insert([{ slug: row.slug, label: row.label, metadata: row.metadata }])
        .select('id, slug, label, status, metadata, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      return data as DbEigenAccessGroupRow;
    },

    async upsertMember(input: {
      groupId: string;
      userId: string;
      role: EigenAccessGroupMemberRole;
    }) {
      const { error } = await client
        .from('eigen_access_group_members')
        .upsert([{ group_id: input.groupId, user_id: input.userId, role: input.role }], {
          onConflict: 'group_id,user_id',
        });
      if (error) throw new Error(error.message);
    },

    async removeMember(groupId, userId) {
      const { error } = await client
        .from('eigen_access_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },

    async archiveGroup(groupId, updatedAt) {
      const { error } = await client
        .from('eigen_access_groups')
        .update({ status: 'archived', updated_at: updatedAt })
        .eq('id', groupId);
      if (error) throw new Error(error.message);
    },
  };
}
