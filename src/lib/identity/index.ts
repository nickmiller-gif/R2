export * from './entity-ref.js';
export * from './alias.js';
export * from './meg-lookup.js';
export * from './meg-cross-domain.js';
// Re-export actor normalization so callers import from a single identity entry point.
export { normalizeActor, type MegIdentity } from '../provenance/actor.js';
