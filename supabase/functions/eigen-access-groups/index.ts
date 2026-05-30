import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { createEigenAccessGroupService } from '../../../src/services/eigen/access-group.service.ts';
import { createEigenAccessGroupDb } from '../_shared/eigen-access-group-db.ts';
import { mapEigenAccessGroupHttpStatus } from '../_shared/eigen-access-group-errors.ts';

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const client = getServiceClient();
    const accessGroups = createEigenAccessGroupService(createEigenAccessGroupDb(client));

    if (req.method === 'GET') {
      const roleCheck = await requireRole(auth.claims.userId, 'member');
      if (!roleCheck.ok) return roleCheck.response;

      try {
        if (roleCheck.roles.includes('admin')) {
          const groups = await accessGroups.listAllForAdmin();
          return jsonResponse({ groups });
        }

        const groups = await accessGroups.listForMember(auth.claims.userId);
        return jsonResponse({ groups });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return errorResponse(message, mapEigenAccessGroupHttpStatus(message));
      }
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

      try {
        if (action === 'create_group') {
          const label = typeof body.label === 'string' ? body.label : '';
          const slug = typeof body.slug === 'string' ? body.slug : undefined;
          const metadata =
            body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
              ? (body.metadata as Record<string, unknown>)
              : undefined;

          const group = await accessGroups.createGroup({ label, slug, metadata });
          return jsonResponse(group, 201);
        }

        if (action === 'add_member') {
          const groupId = typeof body.group_id === 'string' ? body.group_id : '';
          const userId = typeof body.user_id === 'string' ? body.user_id : '';
          await accessGroups.addMember({ groupId, userId });
          return jsonResponse({ ok: true, group_id: groupId.trim(), user_id: userId.trim() });
        }

        if (action === 'remove_member') {
          const groupId = typeof body.group_id === 'string' ? body.group_id : '';
          const userId = typeof body.user_id === 'string' ? body.user_id : '';
          await accessGroups.removeMember({ groupId, userId });
          return jsonResponse({ ok: true });
        }

        if (action === 'archive_group') {
          const groupId = typeof body.group_id === 'string' ? body.group_id : '';
          await accessGroups.archiveGroup(groupId);
          return jsonResponse({ ok: true, group_id: groupId.trim(), status: 'archived' });
        }

        return errorResponse('Unknown action', 400);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return errorResponse(message, mapEigenAccessGroupHttpStatus(message));
      }
    }

    return errorResponse('Method not allowed', 405);
  }),
);
