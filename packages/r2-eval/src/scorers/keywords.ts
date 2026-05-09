import type { EvalCorpusEntry } from '../corpus.ts';

export type KeywordScore = {
  pass: boolean;
  score: number;
  detail: string;
};

/**
 * Deterministic scorer for CI harnesses — substring allow/deny lists only.
 * Extend later with LLM-judge scorers for semantic cases.
 */
export function scoreKeywordConstraints(response: string, entry: EvalCorpusEntry): KeywordScore {
  const lower = response.toLowerCase();
  if (entry.forbid_substrings?.length) {
    for (const frag of entry.forbid_substrings) {
      if (response.includes(frag)) {
        return {
          pass: false,
          score: 0,
          detail: `forbidden substring present: ${frag.slice(0, 24)}`,
        };
      }
    }
  }
  if (entry.expect_substrings?.length) {
    const missing = entry.expect_substrings.filter((s) => !lower.includes(s.toLowerCase()));
    if (missing.length > 0) {
      return {
        pass: false,
        score: 0,
        detail: `missing expected: ${missing.join(', ')}`,
      };
    }
  }
  return { pass: true, score: 1, detail: 'keyword rules satisfied' };
}
