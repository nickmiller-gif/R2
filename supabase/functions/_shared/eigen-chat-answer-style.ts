/**
 * Shared instructions for Eigen chat surfaces (EigenX, public, widget).
 * Keeps replies readable: no bracketed citation noise unless the user asks for sources.
 */

export const EIGEN_CHAT_PROSE_STYLE = [
  'Answer in clear, conversational prose.',
  'Do not use inline citation markers: no bracketed numbers like [1], no footnotes, and no "Source 1" / "Snippet 2" labels in the body of the answer.',
  'The retrieved snippets may be labeled [1], [2], … only to help you read them; do not echo those labels back to the user.',
  'If the user explicitly asks where the information came from, what sources you used, or similar, then give a short separate answer: plain-language bullets with page titles, section names, or URLs as they appear in the snippets—still without numeric citation brackets.',
].join(' ');

/** Append prose-style rules after any custom or default system prompt. */
export function withEigenChatProseStyle(systemPrompt: string): string {
  const base = systemPrompt.trim();
  if (!base) return EIGEN_CHAT_PROSE_STYLE;
  return `${base}\n\n${EIGEN_CHAT_PROSE_STYLE}`;
}

/** User-message preamble so the model does not mirror internal snippet labels. */
export const EIGEN_RETRIEVED_CONTEXT_INTRO =
  'Retrieved snippets (labels like [1] are for your internal reading only; your answer to the user must not repeat them):';
