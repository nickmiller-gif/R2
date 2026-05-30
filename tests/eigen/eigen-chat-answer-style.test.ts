import { describe, expect, it } from 'vitest';
import {
  EIGEN_CHAT_CONVERSATIONAL_STYLE,
  EIGEN_CHAT_DOMAIN_FOCUS,
  EIGEN_CHAT_PROSE_STYLE,
  EIGEN_CHAT_TECHNICAL_BOUNDARY,
  EIGEN_RAY_CORRESPONDENCE_STYLE,
  EIGENX_DEFAULT_NO_CONTEXT_RESPONSE,
  defaultEigenxSystemPrompt,
  withEigenChatProseStyle,
} from '../../supabase/functions/_shared/eigen-chat-answer-style.ts';

describe('withEigenChatProseStyle', () => {
  it('layers domain focus, technical boundary, conversational style, and prose rules', () => {
    const out = withEigenChatProseStyle('Custom base prompt.');
    expect(out.startsWith('Custom base prompt.')).toBe(true);
    expect(out).toContain(EIGEN_CHAT_DOMAIN_FOCUS);
    expect(out).toContain(EIGEN_CHAT_TECHNICAL_BOUNDARY);
    expect(out).toContain(EIGEN_CHAT_CONVERSATIONAL_STYLE);
    expect(out).toContain(EIGEN_CHAT_PROSE_STYLE);
  });

  it('returns persona layers when base prompt is empty', () => {
    const out = withEigenChatProseStyle('');
    expect(out).toContain('clients, properties, people');
    expect(out).toContain('software architecture');
    expect(out).toContain('knowledgeable chatbot');
  });

  it('adds Ray correspondence style when ray voice is active', () => {
    const out = withEigenChatProseStyle('Base.', true);
    expect(out).toContain(EIGEN_RAY_CORRESPONDENCE_STYLE);
  });

  it('omits Ray correspondence style when ray voice is inactive', () => {
    const out = withEigenChatProseStyle('Base.', false);
    expect(out).not.toContain('correspondence examples');
  });
});

describe('defaultEigenxSystemPrompt', () => {
  it('emphasizes clients, properties, and people when context exists', () => {
    const out = defaultEigenxSystemPrompt(true);
    expect(out.toLowerCase()).toContain('clients');
    expect(out.toLowerCase()).toContain('properties');
    expect(out.toLowerCase()).toContain('people');
    expect(out.toLowerCase()).toContain('correspondence');
  });

  it('invites clarification when no context exists', () => {
    const out = defaultEigenxSystemPrompt(false);
    expect(out.toLowerCase()).toContain('no retrieved context');
    expect(out.toLowerCase()).toContain('client');
  });
});

describe('EIGENX_DEFAULT_NO_CONTEXT_RESPONSE', () => {
  it('is conversational and domain-oriented', () => {
    expect(EIGENX_DEFAULT_NO_CONTEXT_RESPONSE.toLowerCase()).toContain('client');
    expect(EIGENX_DEFAULT_NO_CONTEXT_RESPONSE.toLowerCase()).toContain('property');
    expect(EIGENX_DEFAULT_NO_CONTEXT_RESPONSE.toLowerCase()).toContain('person');
  });
});
