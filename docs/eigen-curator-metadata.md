# Curator metadata for `eigen-ingest` (topics, domain, audience)

Operators and scripts can attach **structured labels** on `document.metadata` when POSTing to **`eigen-ingest`**. The edge function:

1. **Persists** normalized labels on **`documents.tags`** (`topic:…`, `domain:…`, `audience:…`, `lane:…`) for auditing, operator UIs, and retrieval filters.
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

**Tag strings for retrieval:** Use the exact normalized values (for example `topic:retreat-ops`, not the raw topic phrase `Retreat Ops`). The oracle-operator corpus page shows a live **resolved tags** preview that matches ingest.

## Retrieval (`match_knowledge_chunks` + `eigen-retrieve-core`)

RPC **`match_knowledge_chunks`** always applies **policy tags** and **entity ids** on the ANN pool.

Optional **`filter_document_tags`** (wired from **`document_tag_scope`** on `eigen-retrieve`, `eigen-chat`, and `eigen-widget-chat`) restricts candidates by parent document **`documents.tags`**:

- **`filter_document_tag_match`** (default **`any`**): `documents.tags && filter_document_tags` — at least one requested tag appears on the document.
- **`all`**: every entry in `filter_document_tags` must appear on `documents.tags` (still combined with policy/entity rules).

When **`document_tag_scope`** is omitted or empty, behavior matches policy+entity-only retrieval. Curator metadata still adds an **embedding-only prefix** so vectors align with declared topics even without a tag filter.

### ANN probe sizing and empty pool

When a tag scope is set, the service uses a **wider ANN probe** (`computeRetrievalAnnLimitWithDocumentTagScope` in `src/lib/eigen/eigen-retrieve-ann.ts`) before applying the tag hard filter, so sparse tags are less likely to zero out the pool prematurely.

If the tag-filtered probe returns **zero passed rows** but the ANN probe had candidates, **`eigen-retrieve-core`** may **retry once without `document_tag_scope`** (same base `ann_limit`) so callers still get grounded context. Disable with env **`EIGEN_RETRIEVE_TAG_FILTER_FALLBACK=false`**.

`retrieval_runs.decomposition` stores `document_tag_scope`, `document_tag_match`, and `dropped_context_reasons` explains ann limits and any fallback.

### Public / anonymous (`eigen-chat-public`)

**`document_tag_scope`** is accepted but **sanitized**: only tags whose prefix is `topic:`, `domain:`, `audience:`, or `lane:` (case-insensitive prefix check) are kept, **deduped**, and **capped at three** entries. Unknown prefixes are dropped to limit tag-probing on anonymous traffic. **`document_tag_match`** is not honored on the public surface (match mode stays the default `any` semantics when tags are applied).

## Bulk sync (`eigen-ingest-sync.sh`)

Optional env vars are merged into multipart **`metadata`** JSON on each file ingest:

- `CURATOR_TOPICS` — comma- or semicolon-separated topic phrases
- `CURATOR_CONTENT_DOMAIN`, `CURATOR_AUDIENCE`, `CURATOR_CORPUS_LANE`
- `CURATOR_INGEST_CHANNEL` (default `eigen_ingest_sync`)

See [eigen-ingest-sync.md](./eigen-ingest-sync.md).

## Related

- Public URL + file runners: [eigen-public-corpus.md](./eigen-public-corpus.md)
- Producer catalog: [eigen-ingest-producers.md](./eigen-ingest-producers.md)
