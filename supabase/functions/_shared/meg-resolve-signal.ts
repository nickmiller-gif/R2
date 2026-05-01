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

function firstEmail(...candidates: unknown[]): string | null {
  const s = firstString(...candidates);
  if (!s) return null;
  return s.includes('@') ? s.toLowerCase() : null;
}

/**
 * When ingest omitted actor_meg_entity_id, infer RPC args only if we have a
 * strong key (email or explicit actor/user id). Avoid minting from summary
 * alone (would create one-off nodes per signal).
 */
export function inferActorMegResolveArgs(row: FeedRowForMeg): MegResolveRpcArgs | null {
  if (row.actor_meg_entity_id) return null;

  const p = asRecord(row.payload) ?? {};
  const prov = asRecord(p.provenance);

  const email = firstEmail(p.actor_email, p.email, p.user_email, p.actorEmail, p.userEmail);

  const externalId = firstString(
    p.actor_id,
    p.actorId,
    p.user_id,
    p.userId,
    p.sub,
    p.external_actor_id,
    prov?.row_id != null ? String(prov.row_id) : null,
  );

  if (!email && !externalId) return null;

  const nameFromPayload = firstString(
    p.actor_name,
    p.actorName,
    p.display_name,
    p.displayName,
    p.name,
    p.user_name,
    p.userName,
  );

  const canonicalName =
    (nameFromPayload ?? row.summary).trim().slice(0, MEG_RESOLVE_BOUNDS.canonicalNameMaxLength) ||
    'unknown actor';

  const rawEntityType =
    typeof p.actor_entity_type === 'string' && p.actor_entity_type.startsWith('meg:')
      ? p.actor_entity_type
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
  const externalId = firstString(fields.externalId);
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
  const out: MegResolveRpcArgs[] = [];
  const seen = new Set<string>();

  ingestExternalIdList(out, seen, row, p.related_external_ids, 'rext');
  ingestExternalIdList(out, seen, row, p.related_entity_external_ids, 'rexid');
  ingestExternalIdList(out, seen, row, p.related_entities, 'robj');

  if (isCoffeePairingSignal(row)) {
    pushRelatedResolve(out, seen, row, 'matched', {
      emailCandidates: [p.matched_email, p.counterparty_email],
      externalId: firstString(
        p.matched_external_id,
        p.matched_user_id,
        p.matched_actor_id,
        p.pair_user_id,
        p.counterparty_user_id,
        p.counterparty_id,
      ),
      name: firstString(p.matched_name, p.matched_display_name, p.counterparty_name),
      payloadSlice: { coffee_matched: true },
    });
  }

  return out;
}
