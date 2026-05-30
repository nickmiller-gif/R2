import { describe, expect, it } from 'vitest';
import {
  entityEpisodeTopicKey,
  isValidEpisodeTopicKey,
  parseBoundedConsolidateInt,
  sessionEpisodeTopicKey,
} from '../../src/lib/eigen/memory-episode-keys.ts';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('memory-episode-keys hardening', () => {
  it('builds validated topic keys only for UUIDs', () => {
    expect(sessionEpisodeTopicKey(VALID_UUID)).toBe(`session:${VALID_UUID}`);
    expect(sessionEpisodeTopicKey('not-a-uuid')).toBeNull();
    expect(entityEpisodeTopicKey(VALID_UUID)).toBe(`entity:${VALID_UUID}`);
    expect(entityEpisodeTopicKey('../evil')).toBeNull();
  });

  it('validates topic key shape and length', () => {
    expect(isValidEpisodeTopicKey(`session:${VALID_UUID}`)).toBe(true);
    expect(isValidEpisodeTopicKey(`entity:${VALID_UUID}`)).toBe(true);
    expect(isValidEpisodeTopicKey('session:not-a-uuid')).toBe(false);
    expect(isValidEpisodeTopicKey(`session:${VALID_UUID}${'x'.repeat(300)}`)).toBe(false);
  });

  it('clamps consolidate bounds', () => {
    expect(parseBoundedConsolidateInt(undefined, 14, 1, 90)).toBe(14);
    expect(parseBoundedConsolidateInt(999, 14, 1, 90)).toBe(90);
    expect(parseBoundedConsolidateInt(-5, 14, 1, 90)).toBe(1);
    expect(parseBoundedConsolidateInt(Number.NaN, 14, 1, 90)).toBe(14);
  });
});
