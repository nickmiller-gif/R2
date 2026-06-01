import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

const CHAT_SURFACES = ['eigen-chat', 'eigen-chat-public', 'eigen-widget-chat'] as const;

const CORPUS_PATTERNS = [
  /fetchOpenAiCorpusChunksForChat/,
  /resolveChatRetrievalForEigenChat/,
  /Promise\.all\(\[\s*\n?\s*executeEigenRetrieve/,
] as const;

describe('OpenAI corpus chat surfaces (static audit)', () => {
  for (const surface of CHAT_SURFACES) {
    it(`${surface} fans out pgvector + OpenAI corpus and merges with fallback`, () => {
      const src = readFileSync(join(ROOT, `supabase/functions/${surface}/index.ts`), 'utf8');
      for (const pattern of CORPUS_PATTERNS) {
        expect(src).toMatch(pattern);
      }
    });
  }

  it('eigen-chat and eigen-widget-chat log pgvector degradation', () => {
    for (const surface of ['eigen-chat', 'eigen-widget-chat'] as const) {
      const src = readFileSync(join(ROOT, `supabase/functions/${surface}/index.ts`), 'utf8');
      expect(src).toMatch(/pgvector retrieve failed; OpenAI corpus fallback in use/);
    }
  });

  it('eigen-chat-public logs pgvector degradation with correlation id', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/eigen-chat-public/index.ts'), 'utf8');
    expect(src).toMatch(/pgvector retrieve failed; OpenAI corpus fallback in use/);
    expect(src).toMatch(/correlationId: meta\.correlationId/);
  });
});

describe('charter-roles write hardening (static audit)', () => {
  it('uses sanitizeInsert/sanitizeUpdate and validates CharterRole enum', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/charter-roles/index.ts'), 'utf8');
    expect(src).toMatch(/sanitizeInsert/);
    expect(src).toMatch(/sanitizeUpdate/);
    expect(src).toMatch(/isCharterRole/);
    expect(src).not.toMatch(/\.\.\.body\.data/);
  });
});
