/**
 * Eigen chat — format retrieved chunks for LLM prompts (shared by edge functions + Vitest).
 * Keeps types Deno-free so Node typecheck can import this module.
 */
export type ChatConfidenceLabel = 'low' | 'medium' | 'high';

export interface ChatRetrievalChunkForPrompt {
  content: string;
  composite_score?: number;
  similarity_score?: number;
  provenance?: {
    document_id?: string;
    source_system?: string;
    source_ref?: string;
    heading_path?: string[];
    valid_from?: string | null;
  };
}

/**
 * Composite-score boundary below which we emit the strongest caution
 * string regardless of the overall confidence label.
 */
export const LOW_CONFIDENCE_MAX_COMPOSITE = 0.48;

/**
 * Composite-score boundary used together with overall = 'medium' to emit
 * the mixed-quality guidance string. Above this, medium retrieval is
 * treated as good enough that no extra caution is added.
 */
export const MEDIUM_CONFIDENCE_MAX_COMPOSITE = 0.62;

/** Builds the labeled context block passed inside the user message to the LLM. */
export function formatRetrievalContextForLlm(chunks: ChatRetrievalChunkForPrompt[]): string {
  return chunks
    .map((chunk, index) => {
      const lines: string[] = [];
      const hp = chunk.provenance?.heading_path?.filter((s) => String(s).trim().length > 0) ?? [];
      if (hp.length) lines.push(`Path: ${hp.join(' › ')}`);
      const sys = chunk.provenance?.source_system?.trim();
      const ref = chunk.provenance?.source_ref?.trim();
      if (sys || ref) {
        lines.push(`Origin: ${[sys, ref].filter(Boolean).join(' · ')}`);
      }
      const header = lines.length > 0 ? `${lines.join('\n')}\n` : '';
      return `[${index + 1}] ${header}${chunk.content.trim()}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Extra system guidance when retrieval scores are weak or confidence is low.
 * Returns '' when retrieval is strong enough to need no extra caution.
 */
export function eigenRetrievalQualityAppend(
  chunks: ChatRetrievalChunkForPrompt[],
  overall: ChatConfidenceLabel,
): string {
  if (chunks.length === 0) return '';
  const scores = chunks.map((c) =>
    typeof c.composite_score === 'number' && Number.isFinite(c.composite_score)
      ? c.composite_score
      : (c.similarity_score ?? 0),
  );
  const maxComposite = Math.max(0, ...scores);
  if (overall === 'low' || maxComposite < LOW_CONFIDENCE_MAX_COMPOSITE) {
    return (
      'Retrieval relevance is limited. Stay tightly tied to the snippets: use cautious wording, ' +
      'and do not invent facts. If they do not answer the question, say so plainly.'
    );
  }
  if (overall === 'medium' && maxComposite < MEDIUM_CONFIDENCE_MAX_COMPOSITE) {
    return (
      'Relevance is mixed: synthesize carefully. Where the material is thin or ambiguous, ' +
      'say that explicitly instead of guessing.'
    );
  }
  return '';
}
