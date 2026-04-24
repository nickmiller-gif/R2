/** Field names accepted by PATCH handlers (excluding `id` / routing keys). */
const SIGNAL_PATCH_FIELDS = [
  'score',
  'confidence',
  'reasons',
  'tags',
  'status',
  'analysis_document_id',
  'source_asset_id',
  'producer_ref',
  'publication_notes',
];

const SIGNAL_PATCH_ALLOWLIST = new Set(SIGNAL_PATCH_FIELDS);

// Note: `publication_state`, `published_at`, `published_by`, and the
// decision-audit columns (`last_decision_*`, `decision_metadata`) are
// intentionally excluded. They are audit-critical and must only be mutated
// via the publish / approve / reject / defer / challenge / supersede actions
// on the oracle-theses edge function, which write a matching
// `oracle_publication_events` row. Allowing a bare PATCH would bypass that
// audit trail and let an operator flip publication state silently.
const THESIS_PATCH_FIELDS = [
  'title',
  'thesis_statement',
  'meg_entity_id',
  'status',
  'novelty_status',
  'confidence',
  'evidence_strength',
  'uncertainty_summary',
  'metadata',
] as const;

const THESIS_PATCH_ALLOWLIST = new Set<string>(THESIS_PATCH_FIELDS);

const EVIDENCE_PATCH_FIELDS = [
  'signal_id',
  'source_lane',
  'source_class',
  'source_ref',
  'content_summary',
  'confidence',
  'evidence_strength',
  'source_date',
  'publication_url',
  'author_info',
  'metadata',
] as const;

const EVIDENCE_PATCH_ALLOWLIST = new Set<string>(EVIDENCE_PATCH_FIELDS);

function buildPatch(
  body: Record<string, unknown>,
  allowlist: Set<string>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(body)) {
    if (allowlist.has(key)) patch[key] = value;
  }
  return patch;
}

export function buildSafeSignalPatch(body: Record<string, unknown>): Record<string, unknown> {
  return buildPatch(body, SIGNAL_PATCH_ALLOWLIST);
}

export function formatAllowedSignalPatchFields(): string {
  return SIGNAL_PATCH_FIELDS.join(', ');
}

export function buildSafeThesisPatch(body: Record<string, unknown>): Record<string, unknown> {
  return buildPatch(body, THESIS_PATCH_ALLOWLIST);
}

export function formatAllowedThesisPatchFields(): string {
  return THESIS_PATCH_FIELDS.join(', ');
}

export function buildSafeEvidenceItemPatch(body: Record<string, unknown>): Record<string, unknown> {
  return buildPatch(body, EVIDENCE_PATCH_ALLOWLIST);
}

export function formatAllowedEvidenceItemPatchFields(): string {
  return EVIDENCE_PATCH_FIELDS.join(', ');
}

// ---------------------------------------------------------------------------
// Rescore overrides (POST oracle-signals?action=rescore)
//
// A rescore is a versioned supersede: we insert a new oracle_signals row
// carrying over most of the predecessor's metadata but with the operator's
// score update(s). Only the fields below may be overridden per request;
// everything else is copied from the predecessor so rescore can't be used
// to smuggle arbitrary patches onto a new version.
// ---------------------------------------------------------------------------
const SIGNAL_RESCORE_OVERRIDE_FIELDS = [
  'score',
  'confidence',
  'reasons',
  'tags',
  'analysis_document_id',
  'source_asset_id',
  'producer_ref',
] as const;

const SIGNAL_RESCORE_OVERRIDE_ALLOWLIST = new Set<string>(SIGNAL_RESCORE_OVERRIDE_FIELDS);

export function buildSafeSignalRescoreOverrides(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SIGNAL_RESCORE_OVERRIDE_ALLOWLIST.has(key)) overrides[key] = value;
  }
  return overrides;
}

export function formatAllowedSignalRescoreOverrideFields(): string {
  return SIGNAL_RESCORE_OVERRIDE_FIELDS.join(', ');
}
