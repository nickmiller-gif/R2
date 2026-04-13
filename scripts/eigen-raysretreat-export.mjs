import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_EIGEN_INGEST_ENDPOINT =
  process.env.R2_EIGEN_INGEST_ENDPOINT ??
  "https://zudslxucibosjwefojtm.supabase.co/functions/v1/eigen-ingest";
const R2_EIGEN_INGEST_BEARER_TOKEN = process.env.R2_EIGEN_INGEST_BEARER_TOKEN;
const ENABLE_R2_EIGEN_INGEST = process.env.ENABLE_R2_EIGEN_INGEST === "true";
const DRY_RUN = process.env.RAYSRETREAT_EIGEN_DRY_RUN === "true";
const INGEST_TIMEOUT_MS = Number(process.env.RAYSRETREAT_EIGEN_INGEST_TIMEOUT_MS ?? "12000");

const EXPORT_LIMIT = Number(process.env.RAYSRETREAT_EXPORT_LIMIT ?? "100");
const INGEST_CONCURRENCY = Number(process.env.RAYSRETREAT_EIGEN_INGEST_CONCURRENCY ?? "5");
const MAX_INGEST_BODY_CHARS = Number(process.env.RAYSRETREAT_EIGEN_MAX_BODY_CHARS ?? "60000");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!R2_EIGEN_INGEST_BEARER_TOKEN && !DRY_RUN) {
  console.error("Missing R2_EIGEN_INGEST_BEARER_TOKEN");
  process.exit(1);
}
if (!ENABLE_R2_EIGEN_INGEST && !DRY_RUN) {
  console.error("Set ENABLE_R2_EIGEN_INGEST=true to run export (or RAYSRETREAT_EIGEN_DRY_RUN=true)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function rowToDocument(row) {
  const sourceRef = `agenda_thought_pieces:${row.id}`;
  const policyTags = ["eigen_public", "raysretreat", "retreat-thought-piece"];

  if (Array.isArray(row.theme_tags)) {
    for (const tag of row.theme_tags) {
      if (tag && !policyTags.includes(tag)) {
        policyTags.push(tag);
      }
    }
  }

  const rawBody = row.content ?? "";
  const body =
    rawBody.length > MAX_INGEST_BODY_CHARS
      ? `${rawBody.slice(0, MAX_INGEST_BODY_CHARS)}\n\n[truncated_for_ingest=true]`
      : rawBody;

  return {
    source_system: "raysretreat",
    source_ref: sourceRef,
    document: {
      title: String(row.title ?? "Untitled thought piece"),
      body,
      content_type: "retreat_thought_piece",
      metadata: {
        table: "agenda_thought_pieces",
        retreat_year_id: row.retreat_year_id ?? null,
        generated_at: row.generated_at ?? null,
        content_hash: row.content_hash ?? null,
        theme_tags: row.theme_tags ?? [],
        exported_at: new Date().toISOString(),
        ingest_body_truncated: rawBody.length > MAX_INGEST_BODY_CHARS,
      },
    },
    chunking_mode: "hierarchical",
    policy_tags: policyTags,
    entity_ids: [],
  };
}

async function ingest(payload) {
  if (DRY_RUN) {
    console.log(`[dry-run] would ingest ${payload.source_ref}`);
    return;
  }

  const retryDelaysMs = [0, 800, 1800];
  let lastError = null;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    if (retryDelaysMs[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
    }
    try {
      const response = await fetch(R2_EIGEN_INGEST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${R2_EIGEN_INGEST_BEARER_TOKEN}`,
          "x-idempotency-key": `raysretreat:${payload.source_ref}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
      });

      if (response.ok) return;
      lastError = `status=${response.status} body=${(await response.text()).slice(0, 300)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`Ingest failed for ${payload.source_ref}: ${lastError}`);
}

async function main() {
  const { data, error } = await supabase
    .from("agenda_thought_pieces")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(EXPORT_LIMIT);

  if (error) {
    throw new Error(`Failed to read agenda_thought_pieces: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  let ok = 0;
  const queue = [...rows];
  const workerCount = Math.max(1, Math.min(INGEST_CONCURRENCY, queue.length));

  async function worker() {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) return;
      const payload = rowToDocument(row);
      await ingest(payload);
      ok += 1;
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  console.log(`Raysretreat thought pieces export complete: ${ok} documents ingested`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
