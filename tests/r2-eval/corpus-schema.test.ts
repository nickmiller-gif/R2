import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEvalCorpusFile } from '../../packages/r2-eval/src/corpus.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('@r2/eval corpus', () => {
  it('parses prompts/corpus-initial.json with schema guard', () => {
    const path = join(__dirname, '../../packages/r2-eval/prompts/corpus-initial.json');
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const corpus = parseEvalCorpusFile(raw);
    expect(corpus.entries.length).toBeGreaterThanOrEqual(10);
    const domains = new Set(corpus.entries.map((e) => e.domain));
    expect(domains.size).toBeGreaterThanOrEqual(3);
    expect(corpus.entries.some((e) => e.id.startsWith('eval-009'))).toBe(true);
  });
});
