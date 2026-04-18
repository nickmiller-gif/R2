import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { guardAuth } from "../_shared/auth.ts";
import { requireRole } from "../_shared/rbac.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;
  const roleCheck = await requireRole(auth.claims.userId, "member");
  if (!roleCheck.ok) return roleCheck.response;

  const url = new URL(req.url);
  const retrievalRunId = url.searchParams.get("retrieval_run_id");

  if (!retrievalRunId) {
    return jsonResponse({
      status: "receipt_unavailable",
      retrieval_run_id: null,
      lineage: null,
      receipt_missing: true
    });
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from("retrieval_runs")
    .select("id,status,metadata,created_at")
    .eq("id", retrievalRunId)
    .maybeSingle();

  if (error) return errorResponse(error.message, 400);
  if (!data) {
    return jsonResponse({
      status: "lineage_not_found",
      retrieval_run_id: retrievalRunId,
      lineage: null,
      reconciliation_queued: true
    });
  }

  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const ingestRun =
    metadata.ingest_run && typeof metadata.ingest_run === "object"
      ? (metadata.ingest_run as Record<string, unknown>)
      : {};

  return jsonResponse({
    status: "resolved",
    retrieval_run_id: retrievalRunId,
    retrieval_run: {
      id: data.id,
      status: data.status,
      created_at: data.created_at
    },
    lineage: {
      source_entity_type: metadata.source_entity_type ?? null,
      source_entity_id: metadata.source_entity_id ?? null,
      ingest_run: {
        id: ingestRun.id ?? null,
        trigger: ingestRun.trigger ?? null,
        source_system: ingestRun.source_system ?? null
      },
      evidence_tier: metadata.evidence_tier ?? null
    }
  });
});
