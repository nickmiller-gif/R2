import type { EvalCorpusEntry, EvalCorpusFile } from '../corpus.ts';
import { scoreKeywordConstraints } from '../scorers/keywords.ts';

export type DeterministicHarnessResultRow = {
  id: string;
  pass: boolean;
  detail: string;
  scored: boolean;
};

export type DeterministicHarnessSummary = {
  rows: DeterministicHarnessResultRow[];
  /** Pass rate over entries that had keyword rules (0–1). */
  passRateOnScored: number;
  scoredCount: number;
};

function entryHasKeywordRules(entry: EvalCorpusEntry): boolean {
  return (entry.expect_substrings?.length ?? 0) > 0 || (entry.forbid_substrings?.length ?? 0) > 0;
}

/**
 * Runs deterministic scorers against a fixed response provider (e.g. mocked model).
 * Entries without keyword rules count as pass-through (scored=false) for expansion room.
 */
export function runDeterministicHarness(
  corpus: EvalCorpusFile,
  getResponse: (entry: EvalCorpusEntry) => string,
): DeterministicHarnessSummary {
  const rows: DeterministicHarnessResultRow[] = [];
  let scoredPasses = 0;
  let scoredCount = 0;

  for (const entry of corpus.entries) {
    if (!entryHasKeywordRules(entry)) {
      rows.push({ id: entry.id, pass: true, detail: 'no keyword rules', scored: false });
      continue;
    }
    scoredCount += 1;
    const text = getResponse(entry);
    const r = scoreKeywordConstraints(text, entry);
    if (r.pass) scoredPasses += 1;
    rows.push({ id: entry.id, pass: r.pass, detail: r.detail, scored: true });
  }

  const passRateOnScored = scoredCount === 0 ? 1 : scoredPasses / scoredCount;
  return { rows, passRateOnScored, scoredCount };
}
