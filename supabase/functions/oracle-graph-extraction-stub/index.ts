import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { guardAuth } from "../_shared/auth.ts";
import { requireRole } from "../_shared/rbac.ts";
import { getServiceClient } from "../_shared/supabase.ts";

interface ProcessRequest {
  limit?: number;
}

const PROCESSING_STATUSES = new Set(["pending", "processing", "completed", "failed"]);

function asIsoNow(): string {
  return new Date().toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const roleCheck = await requireRole(auth.claims.userId, "operator");
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const serviceClient = getServiceClient();
    const body = (await req.json().catch(() => ({}))) as ProcessRequest;
    const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 50);

    const { data: jobs, error: selectError } = await serviceClient
      .from("oracle_graph_extraction_jobs")
      .select("id, run_id, status, metadata")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (selectError) {
      throw new Error(`Failed to fetch pending jobs: ${selectError.message}`);
    }

    const processed: Array<Record<string, unknown>> = [];
    for (const job of jobs ?? []) {
      const jobId = String(job.id);
      const currentStatus = String(job.status ?? "pending");
      if (!PROCESSING_STATUSES.has(currentStatus)) continue;

      const startedAt = asIsoNow();
      const { error: lockError } = await serviceClient
        .from("oracle_graph_extraction_jobs")
        .update({
          status: "processing",
          started_at: startedAt,
          metadata: {
            ...(job.metadata ?? {}),
            picked_by: "oracle-graph-extraction-stub",
            picked_at: startedAt,
          },
        })
        .eq("id", jobId)
        .eq("status", "pending");

      if (lockError) {
        throw new Error(`Failed to lock graph job ${jobId}: ${lockError.message}`);
      }

      const completedAt = asIsoNow();
      const { error: completeError } = await serviceClient
        .from("oracle_graph_extraction_jobs")
        .update({
          status: "completed",
          completed_at: completedAt,
          metadata: {
            ...(job.metadata ?? {}),
            processed_by: "oracle-graph-extraction-stub",
            processed_at: completedAt,
            extraction_mode: "stub",
          },
        })
        .eq("id", jobId)
        .eq("status", "processing");

      if (completeError) {
        throw new Error(`Failed to complete graph job ${jobId}: ${completeError.message}`);
      }

      processed.push({
        id: jobId,
        run_id: job.run_id,
        status: "completed",
      });
    }

    return jsonResponse({
      processed_count: processed.length,
      jobs: processed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
