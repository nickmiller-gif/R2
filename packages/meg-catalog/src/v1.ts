/**
 * MEG catalog v1.0.0 — vocabulary locked for Phase 3.
 * Changes require semver + ADR per docs/adr/ADR-0004-meg-phase3-preflight.md
 */

export type MegCatalogVersion = '1.0.0';

export type MegEntityType =
  | 'meg:person'
  | 'meg:person:athlete'
  | 'meg:person:operator'
  | 'meg:person:speaker'
  | 'meg:company'
  | 'meg:company:law_firm'
  | 'meg:company:investor'
  | 'meg:property'
  | 'meg:property:tower'
  | 'meg:property:residential'
  | 'meg:property:commercial'
  | 'meg:event'
  | 'meg:event:retreat'
  | 'meg:event:session'
  | 'meg:closing_file'
  | 'meg:ip_matter'
  | 'meg:patent'
  | 'meg:thesis'
  | 'meg:opportunity'
  | 'meg:document'
  | 'meg:topic';

export type MegEdgeType =
  | 'coffee_pairing'
  | 'co_authored_with'
  | 'mentored_by'
  | 'introduced_by'
  | 'attended'
  | 'spoke_at'
  | 'sponsored'
  | 'affiliated_with'
  | 'employed_by'
  | 'represents'
  | 'owns'
  | 'closed_for'
  | 'licensed_to'
  | 'cited_in'
  | 'references'
  | 'relates_to'
  | 'succeeded_by'
  | 'participates_in';

export type MegSourceSystem =
  | 'rays_retreat'
  | 'centralr2'
  | 'operator_workbench'
  | 'oracle_operator'
  | 'autonomous_bot_os'
  | 'cloudflare_agent_chatbot'
  | 'forma_health'
  | 'health_supplement_tr'
  | 'smartplrx'
  | 'smartplrx_trend_tracker'
  | 'ip_insights_hub'
  | 'hpseller'
  | 'open_intel_commons'
  | 'insr'
  | 'r2_widget'
  | 'plrx_external';

export const MEG_CATALOG_VERSION: MegCatalogVersion = '1.0.0';
