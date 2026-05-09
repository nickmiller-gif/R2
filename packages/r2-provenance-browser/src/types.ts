export type ProvenanceNodeKind =
  | "platform_feed_item"
  | "meg_entity"
  | "meg_entity_edge"
  | "oracle_evidence_item";

export interface ProvenanceNode {
  id: string;
  parent_id: string | null;
  kind: ProvenanceNodeKind | string;
  title: string;
  subtitle?: string | null;
  depth: number;
  meta?: Record<string, unknown> | null;
}

export interface ProvenanceChainPayload {
  nodes: ProvenanceNode[];
  error?: string;
}

export function parseProvenanceChainPayload(raw: unknown): ProvenanceChainPayload {
  if (!raw || typeof raw !== "object") {
    return { nodes: [] };
  }
  const o = raw as Record<string, unknown>;
  const err = o.error;
  const nodesRaw = o.nodes;
  const error =
    typeof err === "string"
      ? err
      : err != null && typeof err === "object" && "toString" in err
        ? String(err)
        : undefined;
  if (!Array.isArray(nodesRaw)) {
    return { nodes: [], error };
  }
  const nodes: ProvenanceNode[] = [];
  for (const row of nodesRaw) {
    if (!row || typeof row !== "object") continue;
    const n = row as Record<string, unknown>;
    const id = typeof n.id === "string" ? n.id : null;
    if (!id) continue;
    nodes.push({
      id,
      parent_id: typeof n.parent_id === "string" ? n.parent_id : null,
      kind: typeof n.kind === "string" ? n.kind : "unknown",
      title: typeof n.title === "string" ? n.title : "(untitled)",
      subtitle: typeof n.subtitle === "string" ? n.subtitle : n.subtitle === null ? null : undefined,
      depth: typeof n.depth === "number" && Number.isFinite(n.depth) ? n.depth : 0,
      meta: n.meta && typeof n.meta === "object" ? (n.meta as Record<string, unknown>) : undefined,
    });
  }
  return { nodes, error };
}
