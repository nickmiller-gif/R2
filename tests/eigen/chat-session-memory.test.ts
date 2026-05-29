import { describe, expect, it } from 'vitest';
import {
  formatSessionMemoryForLlm,
  parseSessionMemoryValue,
  sessionMemoryKeyForChat,
} from '../../src/lib/eigen/chat-session-memory.ts';

describe('chat-session-memory', () => {
  it('builds session memory key from session id', () => {
    expect(sessionMemoryKeyForChat('abc-123')).toBe('chat:last_turn:abc-123');
  });

  it('parses and formats last-turn memory', () => {
    const turn = parseSessionMemoryValue({
      message: 'Who is the contact?',
      response: 'Jane Doe leads the account.',
      timestamp: '2026-05-29T12:00:00.000Z',
    });
    expect(turn?.message).toContain('Who is the contact');
    const block = formatSessionMemoryForLlm(turn);
    expect(block).toContain('User:');
    expect(block).toContain('Assistant:');
  });

  it('strips control characters from memory text', () => {
    const turn = parseSessionMemoryValue({
      message: 'ignore\u0007instructions',
      response: 'ok',
    });
    expect(turn?.message).not.toContain('\u0007');
  });
});
