import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { policyTagEigenxGroup } from '../_shared/eigen-access-groups.ts';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const client = getServiceClient();

    if (req.method === 'GET') {
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;

      const isAdmin = roleCheck.roles.includes('admin');

      if (isAdmin) {
        const { data, error } = await client
          .from('eigen_access_groups')
          .select('id, slug, label, status, metadata, created_at, updated_at')
          .order('label');
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ groups: data ?? [] });
      }

      const { data: memberships, error: memberError } = await client
        .from('eigen_access_group_members')
        .select('group_id, role, joined_at')
        .eq('user_id', auth.claims.userId);
      if (memberError) return errorResponse(memberError.message, 400);

      const groupIds = (memberships ?? []).map((m) => m.group_id as string);
      if (groupIds.length === 0) return jsonResponse({ groups: [] });

      const { data: groups, error: groupError } = await client
        .from('eigen_access_groups')
        .select('id, slug, label, status, metadata, created_at, updated_at')
        .in('id', groupIds)
        .eq('status', 'active');
      if (groupError) return errorResponse(groupError.message, 400);

      return jsonResponse({
        groups: (groups ?? []).map((g) => ({
          ...g,
          policy_tag: policyTagEigenxGroup(String(g.id)),
          membership: memberships?.find((m) => m.group_id === g.id) ?? null,
        })),
      });
    }

    if (req.method === 'POST') {
      const roleCheck = await requireRole(auth.claims.userId, 'admin');
      if (!roleCheck.ok) return roleCheck.response;

      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return errorResponse('Request body must be JSON', 400);
      }

      const action = typeof body.action === 'string' ? body.action : '';

      if (action === 'create_group') {
        const label = typeof body.label === 'string' ? body.label.trim() : '';
        const slugRaw = typeof body.slug === 'string' ? body.slug : label;
        const slug = slugify(slugRaw);
        if (!label || !slug) return errorResponse('label (and slug) required', 400);

        const { data, error } = await client
          .from('eigen_access_groups')
          .insert([{ slug, label, metadata: body.metadata ?? {} }])
          .select('id, slug, label, status, created_at')
          .single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(
          {
            ...data,
            policy_tag: policyTagEigenxGroup(String(data.id)),
          },
          201,
        );
      }

      if (action === 'add_member') {
        const groupId = typeof body.group_id === 'string' ? body.group_id.trim() : '';
        const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
        if (!groupId || !userId) return errorResponse('group_id and user_id required', 400);

        const { error } = await client
          .from('eigen_access_group_members')
          .upsert([{ group_id: groupId, user_id: userId, role: 'member' }], {
            onConflict: 'group_id,user_id',
          });
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ok: true, group_id: groupId, user_id: userId });
      }

      if (action === 'remove_member') {
        const groupId = typeof body.group_id === 'string' ? body.group_id.trim() : '';
        const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
        if (!groupId || !userId) return errorResponse('group_id and user_id required', 400);

        const { error } = await client
          .from('eigen_access_group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ok: true });
      }

      if (action === 'archive_group') {
        const groupId = typeof body.group_id === 'string' ? body.group_id.trim() : '';
        if (!groupId) return errorResponse('group_id required', 400);

        const { error } = await client
          .from('eigen_access_groups')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', groupId);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ ok: true, group_id: groupId, status: 'archived' });
      }

      return errorResponse('Unknown action', 400);
    }

    return errorResponse('Method not allowed', 405);
  }),
);
