/**
 * Truth Market promotion — calls public.truth_market_promote via service role.
 * Authenticated operators only (charter_user_roles).
 */
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

type PromoteBody = {
  mode?: 'manual' | 'feed_cluster';
  title?: string;
  institution_gap_summary?: string;
  description?: string | null;
  source_system?: string | null;
  affected_domains?: string[];
  primary_thesis_id?: string | null;
  platform_feed_item_ids?: string[];
  oracle_evidence_item_ids?: string[];
  metadata?: Record<string, unknown>;
  contradiction_summary?: unknown[];
  proof_plan?: Record<string, unknown>;
  governance_requirements?: Record<string, unknown>;
  feed_cluster_limit?: number;
};

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    const roleCheck = await requireRole(auth.claims.userId, 'operator');
    if (!roleCheck.ok) return roleCheck.response;

    let body: PromoteBody;
    try {
      body = (await req.json()) as PromoteBody;
    } catch {
      return errorResponse('Invalid JSON', 400);
    }

    const admin = getServiceClient();
    const ownerId = auth.claims.userId;

    if (body.mode === 'feed_cluster') {
      if (!body.source_system?.trim()) {
        return errorResponse('source_system is required for feed_cluster', 400);
      }
      const { data, error } = await admin.rpc('truth_market_promote_feed_cluster', {
        p_source_system: body.source_system.trim(),
        p_limit: body.feed_cluster_limit ?? 5,
        p_title: body.title ?? null,
        p_owner_user_id: ownerId,
      });
      if (error) return errorResponse(error.message, 422);
      return jsonResponse({ ok: true, result: data });
    }

    if (!body.title?.trim() || !body.institution_gap_summary?.trim()) {
      return errorResponse('title and institution_gap_summary are required', 400);
    }

    const { data, error } = await admin.rpc('truth_market_promote', {
      p_title: body.title.trim(),
      p_institution_gap_summary: body.institution_gap_summary.trim(),
      p_description: body.description ?? null,
      p_source_system: body.source_system ?? null,
      p_affected_domains: body.affected_domains ?? [],
      p_owner_user_id: ownerId,
      p_primary_thesis_id: body.primary_thesis_id ?? null,
      p_platform_feed_item_ids: body.platform_feed_item_ids ?? [],
      p_oracle_evidence_item_ids: body.oracle_evidence_item_ids ?? [],
      p_metadata: body.metadata ?? {},
      p_contradiction_summary: body.contradiction_summary ?? [],
      p_proof_plan: body.proof_plan ?? {},
      p_governance_requirements: body.governance_requirements ?? {},
    });
    if (error) return errorResponse(error.message, 422);
    return jsonResponse({ ok: true, result: data });
  }),
);
