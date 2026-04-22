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
