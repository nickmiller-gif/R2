/**
 * Validated topic keys for memory_episodes (E3 hardening).
 */

import { isValidMegEntityId } from './chat-entity-context.ts';

export const MAX_EPISODE_TOPIC_KEY_CHARS = 256;
export const SESSION_TOPIC_PREFIX = 'session:';
export const ENTITY_TOPIC_PREFIX = 'entity:';

export function isValidEpisodeTopicKey(topicKey: string): boolean {
  const trimmed = topicKey.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EPISODE_TOPIC_KEY_CHARS) return false;
  if (trimmed.startsWith(SESSION_TOPIC_PREFIX)) {
    return isValidMegEntityId(trimmed.slice(SESSION_TOPIC_PREFIX.length));
  }
  if (trimmed.startsWith(ENTITY_TOPIC_PREFIX)) {
    return isValidMegEntityId(trimmed.slice(ENTITY_TOPIC_PREFIX.length));
  }
  return false;
}

export function sessionEpisodeTopicKey(sessionId: string): string | null {
  const id = sessionId.trim();
  if (!isValidMegEntityId(id)) return null;
  return `${SESSION_TOPIC_PREFIX}${id}`;
}

export function entityEpisodeTopicKey(entityId: string): string | null {
  const id = entityId.trim();
  if (!isValidMegEntityId(id)) return null;
  return `${ENTITY_TOPIC_PREFIX}${id}`;
}

export function parseBoundedConsolidateInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
