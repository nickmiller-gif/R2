import { describe, expect, it } from 'vitest';
import {
  buildConversationMessages,
  formatHistoryForContext,
  trimHistoryToBudget,
  type ConversationTurn,
} from '../../src/lib/eigen/chat-history-utils.js';

describe('buildConversationMessages', () => {
  it('returns only the current message when history is empty', () => {
    const result = buildConversationMessages([], 'Hello?');
    expect(result).toEqual([{ role: 'user', content: 'Hello?' }]);
  });

  it('prepends history turns before the current user content', () => {
    const history: ConversationTurn[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ];
    const result = buildConversationMessages(history, 'Q2');
    expect(result).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
    ]);
  });

  it('preserves the exact role values', () => {
    const history: ConversationTurn[] = [
      { role: 'user', content: 'question' },
      { role: 'assistant', content: 'answer' },
    ];
    const messages = buildConversationMessages(history, 'follow-up');
    expect(messages.every((m) => m.role === 'user' || m.role === 'assistant')).toBe(true);
    expect(messages[2]?.role).toBe('user');
  });
});

describe('formatHistoryForContext', () => {
  it('returns empty string for no history', () => {
    expect(formatHistoryForContext([])).toBe('');
  });

  it('formats a single user/assistant pair', () => {
    const turns: ConversationTurn[] = [
      { role: 'user', content: 'What is Rays Retreat?' },
      { role: 'assistant', content: 'A wellness retreat.' },
    ];
    const result = formatHistoryForContext(turns);
    expect(result).toContain('Prior conversation:');
    expect(result).toContain('User: What is Rays Retreat?');
    expect(result).toContain('Assistant: A wellness retreat.');
  });

  it('truncates long content at maxCharsPerTurn', () => {
    const longContent = 'x'.repeat(500);
    const turns: ConversationTurn[] = [
      { role: 'user', content: longContent },
      { role: 'assistant', content: 'Short answer.' },
    ];
    const result = formatHistoryForContext(turns, 400);
    expect(result).toContain('…');
    // The truncated portion should not exceed 400 chars + '…'
    const userLine = result.split('\n').find((l) => l.startsWith('User:'));
    expect(userLine).toBeDefined();
    expect(userLine!.length).toBeLessThan(420);
  });

  it('ignores a trailing unpaired user turn', () => {
    // Odd-length history: last user turn without assistant response is skipped
    const turns: ConversationTurn[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' }, // no assistant yet
    ];
    const result = formatHistoryForContext(turns);
    expect(result).toContain('Q1');
    expect(result).toContain('A1');
    // Q2 has no pair so it is silently omitted
    expect(result).not.toContain('Q2');
  });
});

describe('trimHistoryToBudget', () => {
  function makeTurns(n: number): ConversationTurn[] {
    return Array.from({ length: n }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn-${i}`,
    }));
  }

  it('returns all turns when count is within budget', () => {
    const turns = makeTurns(4);
    expect(trimHistoryToBudget(turns, 10)).toHaveLength(4);
  });

  it('trims to the most recent maxTurns entries', () => {
    const turns = makeTurns(10);
    const trimmed = trimHistoryToBudget(turns, 4);
    expect(trimmed.length).toBeLessThanOrEqual(4);
    // The last turn in the result should match the end of the full list
    expect(trimmed[trimmed.length - 1]?.content).toBe(turns[turns.length - 1]?.content);
  });

  it('drops a trailing unpaired user turn after trim so length is even', () => {
    // 7 turns: window from index 3 would be [u,a,u,a] (maxTurns=4 -> start=3, which is 'assistant')
    // Moving start backward to 2 gives [u,a,u,a,u] (5 items), trim odd -> [u,a,u,a] (4 items, even)
    const turns = makeTurns(7);
    const trimmed = trimHistoryToBudget(turns, 4);
    expect(trimmed.length % 2).toBe(0);
    expect(trimmed[0]?.role).toBe('user');
    expect(trimmed[trimmed.length - 1]?.role).toBe('assistant');
  });

  it('does not return empty when assistant-aligned window has valid pairs nearby', () => {
    // Regression: [u,a,u] with maxTurns=2 used to return [] because
    // start landed on 'assistant' and was moved forward, shrinking the window.
    const turns: ConversationTurn[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
    ];
    const trimmed = trimHistoryToBudget(turns, 2);
    expect(trimmed).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ]);
  });

  it('always starts on a user turn after trimming', () => {
    const turns = makeTurns(10);
    const trimmed = trimHistoryToBudget(turns, 5);
    // After trimming, first turn must be a user turn
    expect(trimmed[0]?.role).toBe('user');
  });

  it('enforces a minimum of 2 turns', () => {
    const turns = makeTurns(6);
    const trimmed = trimHistoryToBudget(turns, 0);
    expect(trimmed.length).toBeGreaterThanOrEqual(2);
  });
});
