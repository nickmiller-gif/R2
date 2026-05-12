/**
 * Anonymous / public-tier guardrails for document_tag_scope (eigen-chat-public).
 */

const ALLOWED_PREFIXES = ['topic:', 'domain:', 'audience:', 'lane:'] as const;
const PUBLIC_MAX_TAGS = 3;

function hasAllowedPrefix(normalized: string): boolean {
  const lower = normalized.toLowerCase();
  return ALLOWED_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Keeps only curator-style tags with known prefixes; caps count for anonymous callers.
 */
export function sanitizePublicDocumentTagScope(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = String(raw).trim();
    if (!t || !hasAllowedPrefix(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= PUBLIC_MAX_TAGS) break;
  }
  return out;
}
