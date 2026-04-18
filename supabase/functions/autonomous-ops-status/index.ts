import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { guardAuth } from "../_shared/auth.ts";
import { requireRole } from "../_shared/rbac.ts";
import { requireIdempotencyKey } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;

  const client = getServiceClient();

  if (req.method === "GET") {
    const roleCheck = await requireRole(auth.claims.userId, "member");
    if (!roleCheck.ok) return roleCheck.response;

    const { data: activeRuns, error: activeError } = await client
      .from("retrieval_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "running"]);
    if (activeError) return errorResponse(activeError.message, 400);

    const { data: failedRuns, error: failedError } = await client
      .from("retrieval_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    if (failedError) return errorResponse(failedError.message, 400);

    return jsonResponse({
      paused: false,
      active_runs: activeRuns ?? null,
      failed_runs: failedRuns ?? null,
      generated_at: new Date().toISOString(),
      note: "Stateless status endpoint. Integrate persistent runtime pause-state for full production control."
    });
  }

  if (req.method === "POST") {
    const roleCheck = await requireRole(auth.claims.userId, "operator");
    if (!roleCheck.ok) return roleCheck.response;
    const idemError = requireIdempotencyKey(req);
    if (idemError) return idemError;

    const body = await req.json();
    const action = body?.action;
    if (!action || typeof action !== "string") {
      return errorResponse("action is required", 400);
    }

    if (action === "pause" || action === "resume") {
      return jsonResponse({
        ok: true,
        action,
        accepted_at: new Date().toISOString(),
        note: "Runtime action accepted. Wire to control-plane persistence for full kill-switch durability."
      });
    }

    if (action === "remediate_failed_runs") {
      const { error } = await client
        .from("retrieval_runs")
        .update({ status: "queued" })
        .eq("status", "failed");
      if (error) return errorResponse(error.message, 400);
      return jsonResponse({
        ok: true,
        action,
        accepted_at: new Date().toISOString()
      });
    }

    return errorResponse(`Unsupported action: ${action}`, 400);
  }

  return errorResponse("Method not allowed", 405);
});
