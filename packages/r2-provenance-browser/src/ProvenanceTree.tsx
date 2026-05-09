import { useMemo, useState } from "react";
import type { ProvenanceNode } from "./types";
import "./provenance-tree.css";

export interface ProvenanceTreeProps {
  nodes: ProvenanceNode[];
  /** Collapse nodes deeper than this (0 = root only). */
  initialExpandDepth?: number;
  className?: string;
  emptyLabel?: string;
}

interface TreeEntry {
  node: ProvenanceNode;
  children: TreeEntry[];
}

function buildForest(nodes: ProvenanceNode[]): TreeEntry[] {
  const byParent = new Map<string | null, ProvenanceNode[]>();
  for (const n of nodes) {
    const p = n.parent_id ?? null;
    const list = byParent.get(p) ?? [];
    list.push(n);
    byParent.set(p, list);
  }
  const sortFn = (a: ProvenanceNode, b: ProvenanceNode) =>
    a.depth - b.depth || a.title.localeCompare(b.title);

  function grow(parent: string | null): TreeEntry[] {
    const rows = byParent.get(parent);
    if (!rows?.length) return [];
    return [...rows].sort(sortFn).map((node) => ({
      node,
      children: grow(node.id),
    }));
  }

  return grow(null);
}

function Row({
  entry,
  depth,
  expandDepth,
}: {
  entry: TreeEntry;
  depth: number;
  expandDepth: number;
}) {
  const [open, setOpen] = useState(depth < expandDepth);
  const hasKids = entry.children.length > 0;
  const showKids = open && hasKids;

  return (
    <div className="r2-prov-row" data-depth={depth}>
      <div className="r2-prov-line">
        {hasKids ? (
          <button
            type="button"
            className="r2-prov-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? "▼" : "▶"}
          </button>
        ) : (
          <span className="r2-prov-toggle-spacer" aria-hidden />
        )}
        <span className="r2-prov-kind">{entry.node.kind}</span>
        <span className="r2-prov-title">{entry.node.title}</span>
      </div>
      {entry.node.subtitle ? (
        <div className="r2-prov-subtitle">{entry.node.subtitle}</div>
      ) : null}
      {showKids ? (
        <div className="r2-prov-children">
          {entry.children.map((c) => (
            <Row key={c.node.id} entry={c} depth={depth + 1} expandDepth={expandDepth} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProvenanceTree({
  nodes,
  initialExpandDepth = 2,
  className,
  emptyLabel = "No provenance nodes returned.",
}: ProvenanceTreeProps) {
  const forest = useMemo(() => buildForest(nodes), [nodes]);

  if (!forest.length) {
    return <div className={className ?? ""}>{emptyLabel}</div>;
  }

  return (
    <div className={["r2-provenance-tree", className].filter(Boolean).join(" ")}>
      {forest.map((e) => (
        <Row key={e.node.id} entry={e} depth={0} expandDepth={initialExpandDepth} />
      ))}
    </div>
  );
}
