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

    const { count: activeRuns, error: activeError } = await client
      .from("retrieval_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "running"]);
    if (activeError) return errorResponse(activeError.message, 400);

    const { count: failedRuns, error: failedError } = await client
      .from("retrieval_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    if (failedError) return errorResponse(failedError.message, 400);

    const { count: queuedRuns, error: queuedError } = await client
      .from("retrieval_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");
    if (queuedError) return errorResponse(queuedError.message, 400);

    const { count: unresolvedLineage, error: unresolvedError } = await client
      .from("retrieval_runs")
      .select("id", { count: "exact", head: true })
      .is("metadata->>source_entity_id", null);
    if (unresolvedError) return errorResponse(unresolvedError.message, 400);

    const { data: runtimeState } = await client
      .from("autonomous_runtime_state")
      .select("paused,pause_reason,updated_at")
      .eq("singleton", true)
      .maybeSingle();

    const { data: strategyWeights } = await client
      .from("autonomous_strategy_weights")
      .select("strategy,weight,updated_at")
      .order("updated_at", { ascending: false })
      .limit(25);

    const backlogEstimate =
      (queuedRuns ?? 0) + (failedRuns ?? 0) + (unresolvedLineage ?? 0);

    return jsonResponse({
      paused: runtimeState?.paused ?? false,
      pause_reason: runtimeState?.pause_reason ?? null,
      active_runs: activeRuns ?? 0,
      failed_runs: failedRuns ?? 0,
      queued_runs: queuedRuns ?? 0,
      unresolved_lineage_runs: unresolvedLineage ?? 0,
      opportunity_backlog_estimate: backlogEstimate,
      strategy_weights: strategyWeights ?? [],
      generated_at: new Date().toISOString(),
      runtime_updated_at: runtimeState?.updated_at ?? null
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
      const paused = action === "pause";
      const reason =
        typeof body?.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : paused
            ? "Paused from operator endpoint"
            : "Resumed from operator endpoint";
      const { error } = await client.from("autonomous_runtime_state").upsert({
        singleton: true,
        paused,
        pause_reason: reason,
        updated_by: auth.claims.userId
      });
      if (error) return errorResponse(error.message, 400);
      return jsonResponse({
        ok: true,
        action,
        accepted_at: new Date().toISOString(),
        paused,
        reason
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

    if (action === "record_learning_outcome") {
      const strategy = body?.strategy;
      const runId = body?.run_id;
      const expected = Number(body?.expected_impact);
      const actual = Number(body?.actual_impact);
      if (
        !strategy ||
        typeof strategy !== "string" ||
        !runId ||
        typeof runId !== "string" ||
        Number.isNaN(expected) ||
        Number.isNaN(actual)
      ) {
        return errorResponse(
          "strategy, run_id, expected_impact, and actual_impact are required",
          400
        );
      }
      const errorValue = Number((actual - expected).toFixed(4));
      const { data: existing } = await client
        .from("autonomous_strategy_weights")
        .select("weight")
        .eq("strategy", strategy)
        .maybeSingle();
      const nextWeight = Math.max(
        0.1,
        Number(((existing?.weight ?? 1) + errorValue * 0.3).toFixed(4))
      );

      const { error: strategyError } = await client
        .from("autonomous_strategy_weights")
        .upsert({
          strategy,
          weight: nextWeight,
          updated_at: new Date().toISOString()
        });
      if (strategyError) return errorResponse(strategyError.message, 400);

      const { error: outcomeError } = await client
        .from("autonomous_learning_outcomes")
        .insert({
          run_id: runId,
          strategy,
          expected_impact: expected,
          actual_impact: actual,
          error: errorValue,
          updated_weight: nextWeight,
          notes:
            typeof body?.notes === "string" ? body.notes : "recorded via ops endpoint"
        });
      if (outcomeError) return errorResponse(outcomeError.message, 400);

      return jsonResponse({
        ok: true,
        action,
        run_id: runId,
        strategy,
        error: errorValue,
        updated_weight: nextWeight,
        accepted_at: new Date().toISOString()
      });
    }

    return errorResponse(`Unsupported action: ${action}`, 400);
  }

  return errorResponse("Method not allowed", 405);
});
