/**
 * Shared identity primitives used across all R2 domains.
 *
 * EntityRef  — canonical cross-domain entity reference.
 * Alias      — alternative name/id attached to an EntityRef.
 */

/**
 * Canonical reference to any entity in the R2 ecosystem.
 * The (domain, id) pair forms a globally unique key.
 */
export interface EntityRef {
  /** The owning domain (e.g., 'charter', 'oracle', 'eigen', 'foundation'). */
  domain: string;
  /** The entity's stable UUID within that domain. */
  id: string;
  /** Optional hint describing the entity kind (e.g., 'governance', 'signal'). */
  kind?: string;
}

/**
 * Recognised alias kinds for entity references.
 *
 * - slug         – URL-safe human-readable identifier
 * - external_id  – ID from an external system
 * - display_name – Human-visible label/name
 * - shortcode    – Brief alphanumeric code
 */
export type AliasKind = 'slug' | 'external_id' | 'display_name' | 'shortcode';

/**
 * An alternative identifier attached to an EntityRef.
 */
export interface Alias {
  /** The entity this alias refers to. */
  entityRef: EntityRef;
  /** The kind of alias. */
  aliasKind: AliasKind;
  /** The alias value. */
  value: string;
}
