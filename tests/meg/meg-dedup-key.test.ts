import { describe, expect, it } from 'vitest';
import {
  expandStreetTokens,
  normalizeTextCore,
  propertyDedupKey,
} from '../../src/lib/meg-dedup-key.js';

describe('meg property dedup keys', () => {
  it('normalizes street suffixes and punctuation', () => {
    expect(normalizeTextCore('  1657 Methyl St. ')).toBe('1657 methyl st');
    expect(expandStreetTokens('1657 methyl st')).toBe('1657 methyl street');
  });

  it('matches same property across formatting variants', () => {
    const a = propertyDedupKey({
      name: '1657 Methyl Street',
      address: '1657 Methyl St',
      city: 'Denver',
      state: 'CO',
    });
    const b = propertyDedupKey({
      name: 'Rental — 1657 Methyl',
      address: '1657 methyl st',
      city: 'denver',
      state: 'co',
    });
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it('differs when city or state changes', () => {
    const denver = propertyDedupKey({
      name: '1657 Methyl St',
      address: '1657 Methyl St',
      city: 'Denver',
      state: 'CO',
    });
    const aurora = propertyDedupKey({
      name: '1657 Methyl St',
      address: '1657 Methyl St',
      city: 'Aurora',
      state: 'CO',
    });
    expect(denver).not.toBe(aurora);
  });
});
