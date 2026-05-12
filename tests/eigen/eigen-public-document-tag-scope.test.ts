import { describe, expect, it } from 'vitest';
import { sanitizePublicDocumentTagScope } from '../../src/lib/eigen/eigen-public-document-tag-scope.js';

describe('sanitizePublicDocumentTagScope', () => {
  it('keeps curator prefixes and dedupes', () => {
    expect(sanitizePublicDocumentTagScope(['topic:a', 'domain:b', 'topic:a'])).toEqual([
      'topic:a',
      'domain:b',
    ]);
  });

  it('drops unknown prefixes and caps at 3', () => {
    const out = sanitizePublicDocumentTagScope([
      'topic:1',
      'foo:bar',
      'audience:ops',
      'lane:x',
      'domain:y',
    ]);
    expect(out).toEqual(['topic:1', 'audience:ops', 'lane:x']);
  });
});
