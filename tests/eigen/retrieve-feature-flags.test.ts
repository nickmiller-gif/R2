import { describe, expect, it } from 'vitest';
import {
  parseBooleanEnvFlag,
  readEigenEnableMultiQueryFusion,
} from '../../src/lib/eigen/retrieve-feature-flags.ts';

describe('retrieve-feature-flags', () => {
  it('parses common truthy env values', () => {
    expect(parseBooleanEnvFlag('true')).toBe(true);
    expect(parseBooleanEnvFlag('1')).toBe(true);
    expect(parseBooleanEnvFlag('yes')).toBe(true);
    expect(parseBooleanEnvFlag('on')).toBe(true);
  });

  it('defaults to false when unset or empty', () => {
    expect(parseBooleanEnvFlag(undefined)).toBe(false);
    expect(parseBooleanEnvFlag('')).toBe(false);
    expect(parseBooleanEnvFlag(null, true)).toBe(true);
  });

  it('treats other values as false', () => {
    expect(parseBooleanEnvFlag('false')).toBe(false);
    expect(parseBooleanEnvFlag('0')).toBe(false);
  });

  it('reads multi-query fusion flag from env', () => {
    expect(readEigenEnableMultiQueryFusion('true')).toBe(true);
    expect(readEigenEnableMultiQueryFusion(undefined)).toBe(false);
  });
});
