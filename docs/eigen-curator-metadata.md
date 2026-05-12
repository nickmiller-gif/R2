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

## Retrieval today

`match_knowledge_chunks` still filters on **policy tags** and **entity ids** only. Curator tags are **not** yet a hard filter in ANN; they improve **semantic recall** via the embedding prefix and support **governance / audit** via `documents.tags`. When product needs topic-scoped retrieval, extend the RPC or post-filter using `documents.tags` joined from `document_id`.

## Related

- Public URL + file runners: [eigen-public-corpus.md](./eigen-public-corpus.md)
- Producer catalog: [eigen-ingest-producers.md](./eigen-ingest-producers.md)
