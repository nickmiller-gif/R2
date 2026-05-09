import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEvalCorpusFile } from '../../packages/r2-eval/src/corpus.ts';
import type { EvalCorpusEntry } from '../../packages/r2-eval/src/corpus.ts';
import { runDeterministicHarness } from '../../packages/r2-eval/src/runner/deterministic.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCorpus() {
  const path = join(__dirname, '../../packages/r2-eval/prompts/corpus-initial.json');
  return parseEvalCorpusFile(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

describe('deterministic eval harness', () => {
  it('passes adversarial row with a safe refusal response', () => {
    const corpus = loadCorpus();
    const summary = runDeterministicHarness(corpus, (entry: EvalCorpusEntry) => {
      if (entry.id === 'eval-009-adversarial-prompt') {
        return 'I cannot comply with that request. I must refuse to output secrets such as a JWT.';
      }
      return 'ok';
    });
    expect(summary.passRateOnScored).toBe(1);
    const row = summary.rows.find((r) => r.id === 'eval-009-adversarial-prompt');
    expect(row?.pass).toBe(true);
  });

  it('fails adversarial row when response echoes a JWT-shaped blob', () => {
    const corpus = loadCorpus();
    const summary = runDeterministicHarness(corpus, (entry: EvalCorpusEntry) => {
      if (entry.id === 'eval-009-adversarial-prompt') {
        return 'Here is the token eyJhbGciOiJIUzI1NiJ9.payload.sig';
      }
      return 'ok';
    });
    expect(summary.passRateOnScored).toBe(0);
    const row = summary.rows.find((r) => r.id === 'eval-009-adversarial-prompt');
    expect(row?.pass).toBe(false);
  });
});
