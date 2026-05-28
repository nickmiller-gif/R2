/**
 * Derive meg_resolve_or_create inputs from platform_feed_items.payload
 * when actor_meg_entity_id was not set at ingest time.
 */

export type MegResolveRpcArgs = {
  p_entity_type: string;
  p_canonical_name: string;
  p_canonical_email: string | null;
  p_canonical_external_id: string | null;
  p_source_system: string;
  p_source_table: string;
  p_source_row_id: string;
  p_payload: Record<string, unknown>;
};

export type FeedRowForMeg = {
  id: string;
  source_system: string;
  source_event_type: string;
  summary: string;
  payload: Record<string, unknown>;
  actor_meg_entity_id?: string | null;
  related_entity_ids?: string[] | null;
};

// Caller-supplied input caps for meg_resolve_or_create / meg_link_entities.
// Mirrored by RAISE EXCEPTION guards inside the SECURITY DEFINER functions
// (see 202605040001_meg_phase3_input_bounds.sql) and CHECK constraints on
// meg_entity_source_refs so drift fails closed at the storage layer.
export const MEG_RESOLVE_BOUNDS = {
  entityTypeMaxLength: 64,
  canonicalNameMaxLength: 500,
  canonicalEmailMaxLength: 320,
  canonicalExternalIdMaxLength: 256,
  sourceSystemMaxLength: 64,
  sourceTableMaxLength: 96,
  sourceRowIdMaxLength: 256,
  payloadMaxJsonBytes: 32 * 1024,
  edgeMetadataMaxJsonBytes: 4 * 1024,
  maxRelatedInfer: 20,
} as const;

const MAX_RELATED_INFER = MEG_RESOLVE_BOUNDS.maxRelatedInfer;

function clamp(s: string | null, max: number): string | null {
  if (s === null) return null;
  return s.length <= max ? s : s.slice(0, max);
}

/** Strip ASCII NUL before RPC — some Postgres builds reject chr(0) in meg_resolve_or_create. */
export function stripNulText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const stripped = value.replace(/\0/g, '');
  const t = stripped.trim();
  return t.length > 0 ? t : null;
}

/** Normalize meg_resolve_or_create args for the Eigen RPC (bounds + NUL). */
export function sanitizeMegResolveRpcArgs(args: MegResolveRpcArgs): MegResolveRpcArgs {
  const entityType =
    clamp(
      stripNulText(args.p_entity_type) ?? args.p_entity_type,
      MEG_RESOLVE_BOUNDS.entityTypeMaxLength,
    ) ?? args.p_entity_type;
  const nameRaw = stripNulText(args.p_canonical_name) ?? args.p_canonical_name;
  return {
    p_entity_type: entityType,
    p_canonical_name: clamp(nameRaw, MEG_RESOLVE_BOUNDS.canonicalNameMaxLength) ?? '(unnamed)',
    p_canonical_email: clamp(
      stripNulText(args.p_canonical_email),
      MEG_RESOLVE_BOUNDS.canonicalEmailMaxLength,
    ),
    p_canonical_external_id: clamp(
      stripNulText(args.p_canonical_external_id),
      MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength,
    ),
    p_source_system:
      clamp(
        stripNulText(args.p_source_system) ?? args.p_source_system,
        MEG_RESOLVE_BOUNDS.sourceSystemMaxLength,
      ) ?? args.p_source_system,
    p_source_table:
      clamp(
        stripNulText(args.p_source_table) ?? args.p_source_table,
        MEG_RESOLVE_BOUNDS.sourceTableMaxLength,
      ) ?? args.p_source_table,
    p_source_row_id:
      clamp(
        stripNulText(args.p_source_row_id) ?? args.p_source_row_id,
        MEG_RESOLVE_BOUNDS.sourceRowIdMaxLength,
      ) ?? args.p_source_row_id,
    p_payload: args.p_payload,
  };
}

function jsonByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? {})).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Replace oversized payloads with a marker so downstream
 * meg_resolve_or_create cannot bloat meg_entities.attributes.
 */
function boundPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const bytes = jsonByteLength(payload);
  if (bytes <= MEG_RESOLVE_BOUNDS.payloadMaxJsonBytes) return payload;
  return {
    __meg_payload_truncated: true,
    original_byte_length: bytes,
    cap_bytes: MEG_RESOLVE_BOUNDS.payloadMaxJsonBytes,
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string') {
      const t = c.trim();
      if (t) return t;
    }
  }
  return null;
}

function emailFromScalar(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.includes('@') ? t.toLowerCase() : null;
}

/** First string among candidates that looks like an email (scans all, not only first string). */
function firstEmail(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const e = emailFromScalar(c);
    if (e) return e;
  }
  return null;
}

/** Stable string id from primitives (e.g. parcel numbers). */
function stableId(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/** CentralR2 stores most identity fields under `raw_payload.metadata`. */
function payloadAndMetadata(payload: Record<string, unknown>): {
  p: Record<string, unknown>;
  m: Record<string, unknown>;
} {
  const m = asRecord(payload.metadata) ?? {};
  return { p: payload, m };
}

function pickPm(
  p: Record<string, unknown>,
  m: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = firstString(p[k], m[k]);
    if (v) return v;
  }
  return null;
}

function pickEmailPm(
  p: Record<string, unknown>,
  m: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = firstEmail(p[k], m[k]);
    if (v) return v;
  }
  return null;
}

/**
 * When ingest omitted actor_meg_entity_id, infer RPC args only if we have a
 * strong key (email or explicit actor/user id). Avoid minting from summary
 * alone (would create one-off nodes per signal).
 */
export function inferActorMegResolveArgs(row: FeedRowForMeg): MegResolveRpcArgs | null {
  if (row.actor_meg_entity_id) return null;

  const p = asRecord(row.payload) ?? {};
  const { m } = payloadAndMetadata(p);
  const prov = asRecord(p.provenance);

  const email = pickEmailPm(
    p,
    m,
    'actor_email',
    'email',
    'user_email',
    'actorEmail',
    'userEmail',
    'inquirer_email',
    'contact_email',
  );

  const externalId = firstString(
    p.actor_id,
    p.actorId,
    p.user_id,
    p.userId,
    p.sub,
    p.client_id,
    p.clientId,
    p.external_actor_id,
    m.actor_id,
    m.actorId,
    m.user_id,
    m.userId,
    m.sub,
    m.external_actor_id,
    m.client_id,
    /** r2app coffee_match_created — initiator (JWT sub) */
    p.attendee_a_external_id,
    m.attendee_a_external_id,
    /** Generic retreat / producer stable user keys */
    p.attendee_external_id,
    m.attendee_external_id,
    p.initiator_user_id,
    m.initiator_user_id,
    p.initiator_external_id,
    m.initiator_external_id,
    prov?.row_id != null ? String(prov.row_id) : null,
  );

  if (!email && !externalId) return null;

  const nameFromPayload = pickPm(
    p,
    m,
    'actor_name',
    'actorName',
    'display_name',
    'displayName',
    'name',
    'user_name',
    'userName',
    'inquirer_name',
  );

  const rawEntityTypePick = pickPm(p, m, 'actor_entity_type', 'actorEntityType');
  const summarySafe = stripNulText(row.summary) ?? row.summary;
  const canonicalName =
    (nameFromPayload ?? summarySafe).trim().slice(0, MEG_RESOLVE_BOUNDS.canonicalNameMaxLength) ||
    'unknown actor';

  const rawEntityType =
    typeof rawEntityTypePick === 'string' && rawEntityTypePick.startsWith('meg:')
      ? rawEntityTypePick
      : 'meg:person';
  const entityType = clamp(rawEntityType, MEG_RESOLVE_BOUNDS.entityTypeMaxLength) ?? 'meg:person';

  return {
    p_entity_type: entityType,
    p_canonical_name: canonicalName,
    p_canonical_email: clamp(email, MEG_RESOLVE_BOUNDS.canonicalEmailMaxLength),
    p_canonical_external_id: clamp(externalId, MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength),
    p_source_system: clamp(row.source_system, MEG_RESOLVE_BOUNDS.sourceSystemMaxLength) ?? '',
    p_source_table: 'platform_feed_items',
    p_source_row_id: clamp(row.id, MEG_RESOLVE_BOUNDS.sourceRowIdMaxLength) ?? row.id,
    p_payload: boundPayload(p),
  };
}

export function isCoffeePairingSignal(
  row: Pick<FeedRowForMeg, 'source_event_type' | 'payload'>,
): boolean {
  const t = (row.source_event_type ?? '').toLowerCase();
  if (t.includes('coffee')) return true;
  const p = asRecord(row.payload) ?? {};
  if (p.coffee_match || p.coffee_pairing || p.coffeeMatch) return true;
  return false;
}

/**
 * Choose the paired meg entity for a coffee signal: first related id that is
 * not the actor. Call after related_entity_ids has been populated.
 */
export function pickCoffeeMatchTargetMegEntityId(
  actorMegEntityId: string | null | undefined,
  relatedMegEntityIds: string[],
): string | null {
  if (!actorMegEntityId) return null;
  const other = relatedMegEntityIds.find((id) => id && id !== actorMegEntityId);
  return other ?? null;
}

type RelatedResolveFields = {
  entityType?: unknown;
  /** Single email field or use `emailCandidates` for multiple keys. */
  email?: unknown;
  emailCandidates?: unknown[];
  externalId?: unknown;
  name?: unknown;
  payloadSlice: Record<string, unknown>;
};

function pushRelatedResolve(
  out: MegResolveRpcArgs[],
  seen: Set<string>,
  row: FeedRowForMeg,
  suffix: string,
  fields: RelatedResolveFields,
): void {
  if (out.length >= MAX_RELATED_INFER) return;

  const email = fields.emailCandidates?.length
    ? firstEmail(...fields.emailCandidates)
    : firstEmail(fields.email);
  const externalId = firstString(fields.externalId) ?? stableId(fields.externalId);
  if (!email && !externalId) return;

  const dedupeKey = `${externalId ?? ''}\u0000${email ?? ''}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);

  const rawEntityType =
    typeof fields.entityType === 'string' && fields.entityType.startsWith('meg:')
      ? fields.entityType
      : 'meg:person';
  const entityType = clamp(rawEntityType, MEG_RESOLVE_BOUNDS.entityTypeMaxLength) ?? 'meg:person';

  const nameFromPayload = firstString(fields.name);
  const canonicalName =
    (nameFromPayload ?? (externalId ? `related:${externalId}` : email) ?? 'related entity')
      .trim()
      .slice(0, MEG_RESOLVE_BOUNDS.canonicalNameMaxLength) || 'related entity';

  const sourceRowId = `${row.id}:${suffix}`;

  out.push({
    p_entity_type: entityType,
    p_canonical_name: canonicalName,
    p_canonical_email: clamp(email, MEG_RESOLVE_BOUNDS.canonicalEmailMaxLength),
    p_canonical_external_id: clamp(externalId, MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength),
    p_source_system: clamp(row.source_system, MEG_RESOLVE_BOUNDS.sourceSystemMaxLength) ?? '',
    p_source_table: 'platform_feed_items.related',
    p_source_row_id: clamp(sourceRowId, MEG_RESOLVE_BOUNDS.sourceRowIdMaxLength) ?? sourceRowId,
    p_payload: boundPayload(fields.payloadSlice),
  });
}

function ingestExternalIdList(
  out: MegResolveRpcArgs[],
  seen: Set<string>,
  row: FeedRowForMeg,
  raw: unknown,
  prefix: string,
): void {
  if (!Array.isArray(raw)) return;
  let i = 0;
  for (const entry of raw) {
    if (out.length >= MAX_RELATED_INFER) break;
    if (typeof entry === 'string' && entry.trim()) {
      pushRelatedResolve(out, seen, row, `${prefix}:${i}`, {
        externalId: entry.trim(),
        payloadSlice: { related_external_id: entry.trim() },
      });
    } else {
      const o = asRecord(entry);
      if (o) {
        pushRelatedResolve(out, seen, row, `${prefix}:${i}`, {
          entityType: o.entity_type ?? o.entityType,
          email: o.email ?? o.primary_email ?? o.user_email,
          externalId: o.external_id ?? o.externalId ?? o.id ?? o.user_id ?? o.sub,
          name: o.name ?? o.display_name ?? o.canonical_name,
          payloadSlice: { related_object: true, index: i },
        });
      }
    }
    i += 1;
  }
}

/**
 * Build meg_resolve_or_create calls for related parties when payloads carry
 * external id lists or structured related_entities, plus coffee match slots.
 */
export function inferRelatedMegResolveArgsList(row: FeedRowForMeg): MegResolveRpcArgs[] {
  const p = asRecord(row.payload) ?? {};
  const { m } = payloadAndMetadata(p);
  const out: MegResolveRpcArgs[] = [];
  const seen = new Set<string>();

  ingestExternalIdList(out, seen, row, p.related_external_ids, 'rext');
  ingestExternalIdList(out, seen, row, m.related_external_ids, 'mrext');
  ingestExternalIdList(out, seen, row, p.related_entity_external_ids, 'rexid');
  ingestExternalIdList(out, seen, row, m.related_entity_external_ids, 'mrexid');
  ingestExternalIdList(out, seen, row, p.related_entities, 'robj');
  ingestExternalIdList(out, seen, row, m.related_entities, 'mrobj');

  if (isCoffeePairingSignal(row)) {
    /** r2app / retreat coffee_match_created — matched attendee (stable id) */
    const counterpartyExt = pickPm(
      p,
      m,
      'attendee_b_external_id',
      'matched_external_id',
      'matched_user_id',
      'matched_actor_id',
      'pair_user_id',
      'counterparty_user_id',
      'counterparty_id',
    );
    if (counterpartyExt) {
      pushRelatedResolve(out, seen, row, 'coffee_counterparty', {
        externalId: counterpartyExt,
        name: firstString(
          p.matched_name,
          p.matched_attendee_name,
          p.matched_display_name,
          p.counterparty_name,
          m.matched_name,
          m.matched_attendee_name,
        ),
        emailCandidates: [
          p.matched_email,
          p.counterparty_email,
          m.matched_email,
          m.counterparty_email,
        ],
        payloadSlice: { coffee_counterparty: true },
      });
    }
    pushRelatedResolve(out, seen, row, 'matched', {
      emailCandidates: [
        p.matched_email,
        p.counterparty_email,
        m.matched_email,
        m.counterparty_email,
      ],
      externalId: pickPm(
        p,
        m,
        'matched_external_id',
        'matched_user_id',
        'matched_actor_id',
        'pair_user_id',
        'counterparty_user_id',
        'counterparty_id',
      ),
      name: firstString(
        p.matched_name,
        p.matched_display_name,
        p.counterparty_name,
        m.matched_name,
        m.matched_display_name,
      ),
      payloadSlice: { coffee_matched: true },
    });
  }

  inferCentralr2StructuredResolves(out, seen, row, p, m);
  inferR2ChartStructuredResolves(out, seen, row, p, m);
  inferIpPulsePointStructuredResolves(out, seen, row, p, m);
  inferTypedAssetRelatedResolves(out, seen, row, p, m);

  return out;
}

const COFFEE_COUNTERPARTY_ROW_SUFFIX = ':coffee_counterparty';

/**
 * meg_resolve_or_create args for the coffee counterparty (attendee B / matched
 * stable id), when present in the payload — avoids treating unrelated UUIDs in
 * related_entity_ids as the match target.
 */
export function findCoffeeCounterpartyMegResolveArgs(row: FeedRowForMeg): MegResolveRpcArgs | null {
  for (const args of inferRelatedMegResolveArgsList(row)) {
    if (args.p_source_row_id.endsWith(COFFEE_COUNTERPARTY_ROW_SUFFIX)) {
      return args;
    }
  }
  return null;
}

function centralr2PropertyDedupeKey(
  p: Record<string, unknown>,
  m: Record<string, unknown>,
): string | null {
  const parcel = asRecord(p.parcel) ?? asRecord(m.parcel);
  const pn = stableId(parcel?.parcelNumber);
  if (pn) {
    return pn.length <= MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength
      ? pn
      : pn.slice(0, MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength);
  }
  const state = pickPm(p, m, 'state');
  const zip = pickPm(p, m, 'zip');
  const county = pickPm(p, m, 'county');
  const addr = pickPm(p, m, 'address');
  const parts = [state, zip, county, addr].filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts.join('|').slice(0, MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength);
  return key || null;
}

/** CentralR2 market + valuation scenarios (metadata-heavy producers). */
function inferCentralr2StructuredResolves(
  out: MegResolveRpcArgs[],
  seen: Set<string>,
  row: FeedRowForMeg,
  p: Record<string, unknown>,
  m: Record<string, unknown>,
): void {
  if (row.source_system !== 'centralr2') return;

  const fn = pickPm(p, m, 'function_name');
  if (
    fn === 'property-lookup' ||
    fn === 'rental-analysis' ||
    row.source_event_type === 'mesh_signal_correlated'
  ) {
    const ext = centralr2PropertyDedupeKey(p, m);
    if (ext) {
      const label = pickPm(p, m, 'address') ?? row.summary;
      pushRelatedResolve(out, seen, row, 'centralr2:property', {
        entityType: 'meg:property',
        externalId: ext,
        name: label,
        payloadSlice: { centralr2_property: true, function_name: fn ?? '' },
      });
    }
  }

  const criTypes = new Set(['centralr2_cri_rescore', 'centralr2_cri_verdict_committed']);
  if (criTypes.has(row.source_event_type)) {
    const propertyId = pickPm(p, m, 'property_id');
    if (propertyId) {
      const ext =
        centralr2PropertyDedupeKey(p, m) ??
        propertyId.slice(0, MEG_RESOLVE_BOUNDS.canonicalExternalIdMaxLength);
      pushRelatedResolve(out, seen, row, 'centralr2:cri_property', {
        entityType: 'meg:property',
        externalId: ext,
        name: row.summary,
        payloadSlice: {
          centralr2_cri: true,
          source_event_type: row.source_event_type,
          property_id: propertyId,
        },
      });
    }
  }

  const kind = pickPm(p, m, 'kind');
  if (kind === 'valuation_scenario' || pickPm(p, m, 'scenarioId', 'scenario_id')) {
    const towerId = pickPm(p, m, 'towerAssetId', 'tower_asset_id');
    if (towerId) {
      pushRelatedResolve(out, seen, row, 'centralr2:tower_asset', {
        entityType: 'meg:property',
        externalId: towerId,
        name: firstString(row.summary, pickPm(p, m, 'leaseType', 'lease_type')),
        payloadSlice: { centralr2_valuation: true, field: 'tower_asset' },
      });
    }
    const scenarioId = pickPm(p, m, 'scenarioId', 'scenario_id');
    if (scenarioId) {
      pushRelatedResolve(out, seen, row, 'centralr2:valuation_scenario', {
        entityType: 'meg:event',
        externalId: scenarioId,
        name: row.summary,
        payloadSlice: { centralr2_valuation: true, field: 'scenario' },
      });
    }
  }
}

/** R2Chart / continuity_nexus workspace and signal anchors. */
function inferR2ChartStructuredResolves(
  out: MegResolveRpcArgs[],
  seen: Set<string>,
  row: FeedRowForMeg,
  p: Record<string, unknown>,
  m: Record<string, unknown>,
): void {
  if (row.source_system !== 'r2chart' && row.source_system !== 'continuity_nexus') return;

  const workspaceId = pickPm(
    p,
    m,
    'workspace_id',
    'charter_workspace_id',
    'continuity_workspace_id',
  );
  if (workspaceId) {
    pushRelatedResolve(out, seen, row, 'r2chart:workspace', {
      entityType: 'meg:organization',
      externalId: `r2chart:workspace:${workspaceId}`,
      name: firstString(p.workspace_name, m.workspace_name, row.summary),
      payloadSlice: { r2chart_workspace: true, workspace_id: workspaceId },
    });
  }

  const signalId = pickPm(p, m, 'continuity_signal_id', 'signal_id');
  if (signalId) {
    pushRelatedResolve(out, seen, row, 'r2chart:continuity_signal', {
      entityType: 'meg:event',
      externalId: `r2chart:signal:${signalId}`,
      name: row.summary,
      payloadSlice: { continuity_signal_id: signalId },
    });
  }
}

/** ip_pulse_point analysis and probe shapes (canonical literal on Eigen). */
function inferIpPulsePointStructuredResolves(
  out: MegResolveRpcArgs[],
  seen: Set<string>,
  row: FeedRowForMeg,
  p: Record<string, unknown>,
  m: Record<string, unknown>,
): void {
  if (row.source_system !== 'ip_pulse_point') return;

  const analysisId = pickPm(
    p,
    m,
    'analysis_id',
    'patent_analysis_id',
    'ip_analysis_id',
    'matter_analysis_id',
  );
  if (analysisId) {
    pushRelatedResolve(out, seen, row, 'ip:analysis', {
      entityType: 'meg:event',
      externalId: `ip_pulse_point:analysis:${analysisId}`,
      name: row.summary,
      payloadSlice: { ip_analysis_id: analysisId },
    });
  }
}

/**
 * Non-person nouns: property, IP, patents — keyed by stable external ids in raw_payload.
 * Only runs when a string id is present (no mint-from-summary).
 */
function inferTypedAssetRelatedResolves(
  out: MegResolveRpcArgs[],
  seen: Set<string>,
  row: FeedRowForMeg,
  p: Record<string, unknown>,
  m: Record<string, unknown>,
): void {
  const propertyLabel = firstString(
    pickPm(p, m, 'property_name'),
    pickPm(p, m, 'property_address'),
    pickPm(p, m, 'address'),
  );
  const parcel = asRecord(p.parcel) ?? asRecord(m.parcel);
  const parcelNum = stableId(parcel?.parcelNumber);

  const propertyCandidates: Array<{ suffix: string; ext: unknown; name: unknown }> = [
    {
      suffix: 'property_external_id',
      ext: pickPm(p, m, 'property_external_id'),
      name: propertyLabel,
    },
    { suffix: 'property_id', ext: pickPm(p, m, 'property_id'), name: propertyLabel },
    {
      suffix: 'parcel_apn',
      ext: firstString(pickPm(p, m, 'parcel_apn'), parcelNum ?? undefined),
      name: propertyLabel,
    },
    { suffix: 'apn', ext: pickPm(p, m, 'apn'), name: propertyLabel },
    {
      suffix: 'legal_description_id',
      ext: pickPm(p, m, 'legal_description_id'),
      name: propertyLabel,
    },
  ];
  for (const { suffix, ext, name } of propertyCandidates) {
    if (out.length >= MAX_RELATED_INFER) return;
    const id = firstString(typeof ext === 'string' ? ext : null) ?? stableId(ext);
    if (!id) continue;
    pushRelatedResolve(out, seen, row, `prop:${suffix}`, {
      entityType: 'meg:property',
      externalId: id,
      name,
      payloadSlice: { asset_kind: 'property', field: suffix },
    });
  }

  const matterTitle = pickPm(p, m, 'ip_matter_title', 'matter_title', 'patent_title', 'title');
  const ipCandidates: Array<{ suffix: string; ext: unknown; name: unknown; entityType: string }> = [
    {
      suffix: 'ip_matter_id',
      ext: pickPm(p, m, 'ip_matter_id', 'matter_id', 'matter_uuid', 'ipMatterId', 'docket_id'),
      name: matterTitle,
      entityType: 'meg:ip_matter',
    },
    {
      suffix: 'ip_matter_external_id',
      ext: pickPm(p, m, 'ip_matter_external_id', 'matter_external_id', 'external_matter_id'),
      name: matterTitle,
      entityType: 'meg:ip_matter',
    },
    {
      suffix: 'patent_number',
      ext: pickPm(p, m, 'patent_number', 'patent_num', 'publication_num'),
      name: pickPm(p, m, 'patent_title', 'title'),
      entityType: 'meg:patent',
    },
    {
      suffix: 'application_number',
      ext: pickPm(p, m, 'application_number', 'app_number', 'application_no'),
      name: pickPm(p, m, 'patent_title', 'title'),
      entityType: 'meg:patent',
    },
    {
      suffix: 'publication_number',
      ext: pickPm(p, m, 'publication_number', 'pub_number'),
      name: pickPm(p, m, 'patent_title', 'title'),
      entityType: 'meg:patent',
    },
  ];
  for (const { suffix, ext, name, entityType } of ipCandidates) {
    if (out.length >= MAX_RELATED_INFER) return;
    const id = firstString(typeof ext === 'string' ? ext : null) ?? stableId(ext);
    if (!id) continue;
    pushRelatedResolve(out, seen, row, `ip:${suffix}`, {
      entityType,
      externalId: id,
      name,
      payloadSlice: { asset_kind: 'ip', field: suffix },
    });
  }
}
