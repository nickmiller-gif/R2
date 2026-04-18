/**
 * MEG Entity Alias — alternative identifiers attached to a MEG entity.
 *
 * Aliases allow the same entity to be found via different names,
 * external system IDs, shortcodes, or slugs. The alias table is the
 * primary lookup surface for entity resolution.
 */

export type MegAliasKind = 'slug' | 'external_id' | 'display_name' | 'shortcode' | 'legal_name' | 'dba';

export interface MegEntityAlias {
  id: string;
  megEntityId: string;
  aliasKind: MegAliasKind;
  aliasValue: string;
  source: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateMegEntityAliasInput {
  megEntityId: string;
  aliasKind: MegAliasKind;
  aliasValue: string;
  source?: string | null;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface MegEntityAliasFilter {
  megEntityId?: string;
  aliasKind?: MegAliasKind;
  aliasValue?: string;
  limit?: number;
  offset?: number;
}
