/**
 * ANN probe sizing for match_knowledge_chunks (shared by eigen-retrieve-core and tests).
 */

export function computeRetrievalAnnLimitBase(maxChunks: number): number {
  const mc = Math.max(1, Math.floor(maxChunks));
  return Math.min(Math.max(mc * 8, 100), 500);
}

/** When document tag filter is active, probe a wider ANN pool before hard-filtering. */
export function computeRetrievalAnnLimitWithDocumentTagScope(baseAnnLimit: number): number {
  return Math.min(500, Math.max(baseAnnLimit * 3, 150));
}
