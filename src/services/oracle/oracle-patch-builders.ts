const SIGNAL_PATCH_ALLOWLIST = new Set([
  'score',
  'confidence',
  'reasons',
  'tags',
  'status',
  'analysis_document_id',
  'source_asset_id',
  'producer_ref',
  'publication_notes',
]);

const THESIS_PATCH_ALLOWLIST = new Set([
  'title',
  'thesis_statement',
  'meg_entity_id',
  'status',
  'novelty_status',
  'confidence',
  'evidence_strength',
  'uncertainty_summary',
  'publication_state',
  'metadata',
]);

const EVIDENCE_PATCH_ALLOWLIST = new Set([
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
]);

function buildPatch(body: Record<string, unknown>, allowlist: Set<string>): Record<string, unknown> {
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

export function buildSafeThesisPatch(body: Record<string, unknown>): Record<string, unknown> {
  return buildPatch(body, THESIS_PATCH_ALLOWLIST);
}

export function buildSafeEvidenceItemPatch(body: Record<string, unknown>): Record<string, unknown> {
  return buildPatch(body, EVIDENCE_PATCH_ALLOWLIST);
}
