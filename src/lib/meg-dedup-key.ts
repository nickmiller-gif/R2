/**
 * TypeScript mirror of `meg_normalize_*` SQL helpers (tests + docs).
 * Authoritative dedup runs in Eigen `meg_resolve_or_create`.
 */
import { createHash } from 'node:crypto';

export function normalizeTextCore(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();
}

const STREET_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bst\b/gi, 'street'],
  [/\bstr\b/gi, 'street'],
  [/\bave\b/gi, 'avenue'],
  [/\bav\b/gi, 'avenue'],
  [/\brd\b/gi, 'road'],
  [/\bdr\b/gi, 'drive'],
  [/\bln\b/gi, 'lane'],
  [/\bblvd\b/gi, 'boulevard'],
  [/\bbr\b/gi, 'boulevard'],
];

export function expandStreetTokens(input: string): string {
  let out = input;
  for (const [re, rep] of STREET_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function propertyDedupKey(input: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  const addr = expandStreetTokens(normalizeTextCore(input.address ?? ''));
  const city = normalizeTextCore(input.city ?? '');
  const state = (input.state ?? '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 2);
  const name = expandStreetTokens(normalizeTextCore(input.name ?? ''));

  let core = '';
  if (addr && city && state.length === 2) {
    core = `${addr}|${city}|${state}`;
  } else if (name && city && state.length === 2) {
    core = `${name}|${city}|${state}`;
  } else if (name) {
    core = name;
  } else {
    return null;
  }

  return `prop:${createHash('md5').update(core).digest('hex')}`;
}
