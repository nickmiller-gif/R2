import { createHash } from 'node:crypto';

/**
 * Produces a deterministic SHA-256 hex digest for any serializable value.
 * Used for provenance payload hashing and chain-link verification.
 */
export function hashPayload(value: unknown): string {
  const serialized = JSON.stringify(value, sortedReplacer);
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Computes the next chain hash by hashing the previous chain hash
 * concatenated with the current payload hash.
 */
export function nextChainHash(previousChainHash: string, payloadHash: string): string {
  return createHash('sha256')
    .update(previousChainHash + ':' + payloadHash, 'utf8')
    .digest('hex');
}

/**
 * Returns the genesis chain hash for the first provenance event on an entity.
 * Uses the entity ID as the deterministic seed.
 */
export function genesisChainHash(entityId: string): string {
  return createHash('sha256').update('genesis:' + entityId, 'utf8').digest('hex');
}

/** JSON replacer that sorts object keys for deterministic serialization. */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}
