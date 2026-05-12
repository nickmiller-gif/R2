# Curator metadata for `eigen-ingest` (topics, domain, audience)

Operators and scripts can attach **structured labels** on `document.metadata` when POSTing to **`eigen-ingest`**. The edge function:

1. **Persists** normalized labels on **`documents.tags`** (`topic:…`, `domain:…`, `audience:…`, `lane:…`) for auditing, operator UIs, and future retrieval filters.
2. **Prefixes embeddings only** with a short `[Curator corpus labels: …]` line so vectors align with declared topics **without** changing stored chunk text.

## Supported `document.metadata` keys

| Key              | Type                                   | Maps to `documents.tags` |
| ---------------- | -------------------------------------- | ------------------------ |
| `curator_topics` | `string[]` or comma-separated `string` | `topic:<slug>` per entry |
| `content_domain` | `string`                               | `domain:<slug>`          |
| `audience`       | `string`                               | `audience:<slug>`        |
| `corpus_lane`    | `string`                               | `lane:<slug>`            |

Slugs: lowercased, non-alphanumerics collapsed to `-`, max length capped per tag.

Optional free-form keys (ignored by normalization but echoed in `ingestion_runs.metadata.request_metadata`) are fine—for example `ingest_channel: "oracle_operator_ui"`.

## Retrieval

`match_knowledge_chunks` always applies **policy tags** and **entity ids** on the ANN pool (unchanged). When callers pass **`filter_document_tags`** (wired from **`document_tag_scope`** on `eigen-retrieve` and optional **`document_tag_scope`** on `eigen-chat`, `eigen-widget-chat`, and `eigen-chat-public`), chunks whose parent **`documents.tags`** do not **overlap** that array (`text[] && text[]`) are dropped—use the same normalized tag strings as ingest (for example `topic:hospitality`, `domain:retreat-operations`).

When `document_tag_scope` is omitted or empty, behavior matches the previous policy+entity-only filter. Curator metadata still adds an **embedding-only prefix** so vectors align with declared topics even without a tag filter.

## Related

- Public URL + file runners: [eigen-public-corpus.md](./eigen-public-corpus.md)
- Producer catalog: [eigen-ingest-producers.md](./eigen-ingest-producers.md)
