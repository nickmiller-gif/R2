import { describe, expect, it } from 'vitest';
import {
  EIGEN_MEMORY_EPISODE_INTRO,
  formatMemoryEpisodeForLlm,
} from '../../src/lib/eigen/chat-memory-recall.ts';

describe('chat-memory-recall', () => {
  it('formats episode summary for LLM prompt', () => {
    const block = formatMemoryEpisodeForLlm({
      summary: 'User asked about lease renewal.\nAssistant noted Q4 escalation.',
      turnCount: 4,
      windowEnd: '2026-05-01T10:05:00.000Z',
    });
    expect(block).toContain('Turns summarized: 4');
    expect(block).toContain('lease renewal');
  });

  it('returns empty block for missing episode', () => {
    expect(formatMemoryEpisodeForLlm(null)).toBe('');
    expect(formatMemoryEpisodeForLlm({ summary: '  ', turnCount: 0 })).toBe('');
  });

  it('exports episode intro constant', () => {
    expect(EIGEN_MEMORY_EPISODE_INTRO).toContain('Consolidated conversation memory');
  });
});
