/**
 * Eigen chat — format MEG entity + projection snapshots for LLM prompts.
 * Deno-free so Vitest and edge functions can share formatting logic.
 */

export const EIGEN_ENTITY_CONTEXT_INTRO =
  'Canonical entity context (MEG facts about clients, properties, and people; prefer over generic corpus when they conflict):';

export interface ChatEntityRelationship {
  edgeType: string;
  direction: 'out' | 'in';
  otherEntityId: string;
  otherEntityName?: string;
  otherEntityType?: string;
  confidence?: number | null;
}

export interface ChatEntityForPrompt {
  id: string;
  entityType: string;
  canonicalName: string;
  status: string;
  fields: Record<string, unknown>;
  attributes: Record<string, unknown>;
  enrichmentConsensus: Record<string, unknown>;
  sidecarFields?: Record<string, unknown>;
  relationships?: ChatEntityRelationship[];
  lastSourceSystem?: string;
  lastUpdatedAt?: string;
  sourceLabels?: string[];
}

const ENTITY_FIELD_PRIORITY = [
  'name',
  'canonical_name',
  'industry',
  'description',
  'website',
  'drug_name',
  'address',
  'city',
  'state',
  'apn',
  'parcel_id',
  'role',
  'email',
  'phone',
  'status',
] as const;

const MAX_DESCRIPTION_CHARS = 500;
const MAX_FIELD_VALUE_CHARS = 240;
/** Upper bound on total entity block size injected into the LLM prompt. */
export const MAX_ENTITY_CONTEXT_BLOCK_CHARS = 12_000;

/** Strip null bytes and C0 control chars (keep tab/newline) from user/DB-derived prompt text. */
export function sanitizePromptFieldText(raw: string, maxChars = MAX_FIELD_VALUE_CHARS): string {
  let cleaned = '';
  for (const char of raw.replace(/\0/g, '')) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || code >= 32) cleaned += char;
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)}…`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidMegEntityId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function normalizeEntityScopeIds(raw: string[], max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = item.trim();
    if (!isValidMegEntityId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function mergeEntityFieldMaps(
  attributes: Record<string, unknown>,
  projectionFields: Record<string, unknown>,
): Record<string, unknown> {
  return { ...attributes, ...projectionFields };
}

export function formatEntityTypeLabel(entityType: string, sourceLabels: string[] = []): string {
  const normalized = entityType.trim().toLowerCase();
  if (sourceLabels.some((label) => label.toLowerCase().includes('client'))) {
    return `${normalized} (client)`;
  }
  return normalized;
}

function truncateFieldValue(value: unknown, maxChars = MAX_FIELD_VALUE_CHARS): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    return sanitizePromptFieldText(value, maxChars);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 6)
      .map((item) => truncateFieldValue(item, 80))
      .filter(Boolean)
      .join(', ');
  }
  try {
    const json = JSON.stringify(value);
    if (json.length <= maxChars) return json;
    return `${json.slice(0, maxChars)}…`;
  } catch {
    return '';
  }
}

function orderedFieldEntries(fields: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(fields).filter(([, value]) => value != null && value !== '');
  const prioritized: [string, unknown][] = [];
  const remainder: [string, unknown][] = [];
  for (const key of ENTITY_FIELD_PRIORITY) {
    const match = entries.find(([entryKey]) => entryKey.toLowerCase() === key);
    if (match) prioritized.push(match);
  }
  for (const entry of entries) {
    if (!prioritized.some(([key]) => key === entry[0])) remainder.push(entry);
  }
  return [...prioritized, ...remainder].slice(0, 12);
}

function formatRelationshipLines(relationships: ChatEntityRelationship[] = []): string[] {
  return relationships.slice(0, 8).map((edge) => {
    const arrow = edge.direction === 'out' ? '→' : '←';
    const name = edge.otherEntityName?.trim() || edge.otherEntityId;
    const typeSuffix = edge.otherEntityType ? ` (${edge.otherEntityType})` : '';
    const confidence =
      typeof edge.confidence === 'number' && Number.isFinite(edge.confidence)
        ? ` · conf ${edge.confidence}`
        : '';
    return `Relationship ${arrow} ${edge.edgeType}: ${name}${typeSuffix}${confidence}`;
  });
}

function formatConsensusLines(consensus: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [path, payload] of Object.entries(consensus).slice(0, 6)) {
    if (!payload || typeof payload !== 'object') continue;
    const record = payload as Record<string, unknown>;
    const value =
      record.consensus_value_json ?? record.value ?? record.consensus_value ?? record.text;
    const rendered = truncateFieldValue(value, 160);
    if (rendered) lines.push(`Enrichment · ${path}: ${rendered}`);
  }
  return lines;
}

function formatSingleEntity(entity: ChatEntityForPrompt, index: number): string {
  const lines: string[] = [];
  lines.push(`Entity ${index + 1}: ${entity.canonicalName}`);
  lines.push(`MEG ID: ${entity.id}`);
  lines.push(`Type: ${formatEntityTypeLabel(entity.entityType, entity.sourceLabels)}`);
  lines.push(`Status: ${entity.status}`);

  const merged = mergeEntityFieldMaps(
    mergeEntityFieldMaps(entity.attributes, entity.fields),
    entity.sidecarFields ?? {},
  );
  for (const [key, value] of orderedFieldEntries(merged)) {
    const rendered =
      key.toLowerCase() === 'description'
        ? truncateFieldValue(value, MAX_DESCRIPTION_CHARS)
        : truncateFieldValue(value);
    if (rendered) lines.push(`${key}: ${rendered}`);
  }

  lines.push(...formatConsensusLines(entity.enrichmentConsensus));
  lines.push(...formatRelationshipLines(entity.relationships));

  if (entity.lastSourceSystem || entity.lastUpdatedAt) {
    const provenance = [entity.lastSourceSystem, entity.lastUpdatedAt].filter(Boolean).join(' · ');
    lines.push(`Last updated: ${provenance}`);
  }

  return lines.join('\n');
}

export function formatEntityContextForLlm(entities: ChatEntityForPrompt[]): string {
  if (entities.length === 0) return '';
  const block = entities
    .map((entity, index) => formatSingleEntity(entity, index))
    .join('\n\n---\n\n');
  if (block.length <= MAX_ENTITY_CONTEXT_BLOCK_CHARS) return block;
  return `${block.slice(0, MAX_ENTITY_CONTEXT_BLOCK_CHARS)}…\n\n[entity context truncated]`;
}

export function buildUserMessageWithEntityAndRetrievalContext(input: {
  message: string;
  entityIntro: string;
  entityBlock: string;
  memoryIntro?: string;
  memoryBlock?: string;
  governanceIntro?: string;
  governanceBlock?: string;
  retrievalIntro: string;
  retrievalBlock: string;
  suffix?: string;
}): string {
  const parts = [`Question: ${input.message}`];
  if (input.entityBlock.trim()) {
    parts.push('', input.entityIntro, input.entityBlock.trim());
  }
  if (input.memoryBlock?.trim()) {
    parts.push('', input.memoryIntro ?? '', input.memoryBlock.trim());
  }
  if (input.governanceBlock?.trim()) {
    parts.push('', input.governanceIntro ?? '', input.governanceBlock.trim());
  }
  if (input.retrievalBlock.trim()) {
    parts.push('', input.retrievalIntro, input.retrievalBlock.trim());
  }
  if (input.suffix?.trim()) parts.push(input.suffix.trim());
  return parts.join('\n');
}
