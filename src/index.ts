/**
 * R2 Ecosystem — Headless backend for Oracle, Charter, and Eigen/EigenX.
 *
 * This is the top-level barrel export for the R2 service layer.
 * Each domain exposes its service factories and type-safe interfaces.
 */

// ── Foundation / Shared ──────────────────────────────────────────────
export * from './types/shared/index.js';
export * from './services/documents/index.js';
export * from './services/foundation/index.js';

// Domain-agnostic provenance (prefixed to avoid collision with Charter's provenance)
export {
  createProvenanceService as createSharedProvenanceService,
  type ProvenanceService as SharedProvenanceService,
  type ProvenanceDb as SharedProvenanceDb,
  type DbProvenanceEventRow,
} from './services/provenance/index.js';

// ── Charter (Governance) ─────────────────────────────────────────────
export * from './types/charter/index.js';
export * from './services/charter/index.js';

// ── Oracle (Intelligence) ────────────────────────────────────────────
export * from './types/oracle/index.js';
export * from './services/oracle/index.js';

// ── MEG (Master Entity Graph) ───────────────────────────────────────
export * from './types/meg/index.js';
export * from './services/meg/index.js';

// ── Eigen / EigenX (Knowledge Operating System) ──────────────────────
export * from './types/eigen/index.js';
export * from './services/eigen/index.js';

// ── Library Primitives ───────────────────────────────────────────────
export { hashPayload, genesisChainHash, nextChainHash } from './lib/provenance/hash.js';
export { nowUtc, toUtc, requireUtc, isValidUtcDate, toIsoUtc } from './lib/provenance/clock.js';
export {
  UTC_TIMEZONE,
  makeTimeWindow,
  makeValidityWindow,
  validityWindowToTimeWindow,
  timeWindowContains,
  timeWindowsOverlap,
  intersectTimeWindows,
} from './lib/temporal/index.js';
export { makeEntityRef, entityRefKey, entityRefsEqual, makeAlias, findAlias, aliasIndex, normalizeActor, type MegIdentity } from './lib/identity/index.js';

// ── Oracle Intelligence Primitives ───────────────────────────────────
export * from './lib/oracle/index.js';

// ── Edge Utilities ───────────────────────────────────────────────────
export * from './lib/edge/index.js';
