import { describe, expect, it } from 'vitest';
import {
  expandQueryHeuristically,
  mergeExpansionQueries,
  parseLlmExpansionQueries,
} from '../../src/lib/eigen/query-expansion.ts';
import { createQueryExpansionService } from '../../src/services/eigen/query-expansion.service.ts';

describe('query-expansion', () => {
  it('includes the original query first', () => {
    const queries = expandQueryHeuristically('Who is the main contact at Acme Corp?');
    expect(queries[0]).toMatch(/Acme Corp/i);
    expect(queries.length).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates heuristic expansions', () => {
    const queries = expandQueryHeuristically('Acme');
    const keys = new Set(queries.map((q) => q.toLowerCase()));
    expect(keys.size).toBe(queries.length);
  });

  it('parses llm json array expansions', () => {
    const parsed = parseLlmExpansionQueries(
      'Here you go:\n["Acme Corp contacts", "Acme leadership team"]',
    );
    expect(parsed).toEqual(['Acme Corp contacts', 'Acme leadership team']);
  });

  it('merges original with llm and falls back to heuristics when llm empty', () => {
    const merged = mergeExpansionQueries('What is Eigen retrieval?', []);
    expect(merged[0]).toContain('Eigen retrieval');
    expect(merged.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes service helpers', () => {
    const svc = createQueryExpansionService();
    expect(svc.expandHeuristic('test query').length).toBeGreaterThan(0);
  });
});
