/**
 * Charter provenance types — re-exported from shared for backward compatibility.
 *
 * New code should import from '../../types/shared/provenance.js' directly.
 * This file ensures Charter Slice 01 code continues to work unchanged.
 */
export {
  type ActorKind,
  type ProvenanceActor,
  type ProvenanceEvent,
  type AppendProvenanceInput,
  type ProvenanceLookupFilter,
} from '../shared/provenance.js';
