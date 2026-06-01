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

const US_STATE_BY_NAME: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  NEWHAMPSHIRE: 'NH',
  NEWJERSEY: 'NJ',
  NEWMEXICO: 'NM',
  NEWYORK: 'NY',
  NORTHCAROLINA: 'NC',
  NORTHDAKOTA: 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  RHODEISLAND: 'RI',
  SOUTHCAROLINA: 'SC',
  SOUTHDAKOTA: 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  WESTVIRGINIA: 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
  DISTRICTOFCOLUMBIA: 'DC',
};

export function normalizeUsState(state: string | null | undefined): string {
  const cleaned = (state ?? '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (!cleaned) return '';
  if (cleaned.length === 2) return cleaned;
  const compact = cleaned.replace(/\s+/g, '');
  return US_STATE_BY_NAME[compact] ?? cleaned.slice(0, 2);
}

const STREET_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnorthwest\b/gi, 'northwest'],
  [/\bnw\b/gi, 'northwest'],
  [/\bnortheast\b/gi, 'northeast'],
  [/\bne\b/gi, 'northeast'],
  [/\bsoutheast\b/gi, 'southeast'],
  [/\bse\b/gi, 'southeast'],
  [/\bsouthwest\b/gi, 'southwest'],
  [/\bsw\b/gi, 'southwest'],
  [/\bnorth\b/gi, 'north'],
  [/\bsouth\b/gi, 'south'],
  [/\beast\b/gi, 'east'],
  [/\bwest\b/gi, 'west'],
  [/\bn\b/gi, 'north'],
  [/\bs\b/gi, 'south'],
  [/\be\b/gi, 'east'],
  [/\bw\b/gi, 'west'],
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
  const state = normalizeUsState(input.state);
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
