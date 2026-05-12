/**
 * Curator-supplied corpus metadata (topics, domain, audience) for eigen-ingest.
 * Used for: (1) `documents.tags` audit/filter surface, (2) embedding-only prefix so
 * vectors align with declared topics without mutating stored chunk text.
 */

export const CURATOR_META_KEYS = [
  'curator_topics',
  'content_domain',
  'audience',
  'corpus_lane',
  'ingest_channel',
] as const;

const MAX_TOPIC_INPUTS = 24;
const MAX_TAG_LEN = 72;
const MAX_EMBEDDING_PREFIX_CHARS = 2000;

/** Exported for UI previews; must stay aligned with ingest slug rules. */
export function curatorSlugToken(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (s || 'general').slice(0, 48);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Normalized `documents.tags` entries: `topic:<slug>`, `domain:<slug>`, `audience:<slug>`, `lane:<slug>`.
 */
export function buildCuratorDocumentTags(
  metadata: Record<string, unknown> | undefined | null,
): string[] {
  if (!metadata || typeof metadata !== 'object') return [];

  const out: string[] = [];
  const topics = asStringArray(metadata.curator_topics).slice(0, MAX_TOPIC_INPUTS);
  for (const t of topics) {
    out.push(`topic:${curatorSlugToken(t)}`);
  }

  if (typeof metadata.content_domain === 'string' && metadata.content_domain.trim()) {
    out.push(`domain:${curatorSlugToken(metadata.content_domain)}`);
  }
  if (typeof metadata.audience === 'string' && metadata.audience.trim()) {
    out.push(`audience:${curatorSlugToken(metadata.audience)}`);
  }
  if (typeof metadata.corpus_lane === 'string' && metadata.corpus_lane.trim()) {
    out.push(`lane:${curatorSlugToken(metadata.corpus_lane)}`);
  }

  const capped = [...new Set(out)].map((t) => t.slice(0, MAX_TAG_LEN));
  return capped.slice(0, 40);
}

/**
 * Preview tags from loose form fields (same output as ingest for equivalent metadata).
 * Use in operator UIs so curators see exact `documents.tags` strings before calling eigen-ingest.
 */
export function previewCuratorDocumentTagsFromFormFields(input: {
  topicsRaw?: string;
  contentDomain?: string;
  audience?: string;
  corpusLane?: string;
}): string[] {
  const topics = (input.topicsRaw ?? '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const meta: Record<string, unknown> = {};
  if (topics.length) meta.curator_topics = topics;
  if (input.contentDomain?.trim()) meta.content_domain = input.contentDomain.trim();
  if (input.audience?.trim()) meta.audience = input.audience.trim();
  if (input.corpusLane?.trim()) meta.corpus_lane = input.corpusLane.trim();
  return buildCuratorDocumentTags(meta);
}

/**
 * Prefix prepended only for embedding generation; not stored as chunk text.
 */
export function buildEmbeddingPrefixFromCuratorMetadata(
  metadata: Record<string, unknown> | undefined | null,
): string {
  const tags = buildCuratorDocumentTags(metadata);
  if (!tags.length) return '';
  const line = `[Curator corpus labels: ${tags.join(', ')}]`;
  const block = `${line}\n\n`;
  return block.length > MAX_EMBEDDING_PREFIX_CHARS
    ? `${line.slice(0, MAX_EMBEDDING_PREFIX_CHARS)}\n\n`
    : block;
}

export function buildCuratorSummaryLine(
  metadata: Record<string, unknown> | undefined | null,
): string | null {
  const tags = buildCuratorDocumentTags(metadata);
  if (!tags.length) return null;
  const line = `Curator: ${tags.join(' · ')}`;
  return line.slice(0, 500);
}
