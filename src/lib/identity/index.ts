export * from './entity-ref.js';
export * from './alias.js';
// Re-export actor normalization so callers import from a single identity entry point.
export { normalizeActor, type MegIdentity } from '../provenance/actor.js';
