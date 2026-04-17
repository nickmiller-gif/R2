-- Action-level Tool Capability Supplement.
--
-- Adds fine-grained per-action capabilities alongside the canonical edge.* catalog
-- (seeded in 202604130002 + 202604140001_add_multi_llm_tool_capabilities.sql).
--
-- The edge.* catalog gates policy at the edge-function level (one entry per function,
-- one per read/write direction). This supplement adds action-level granularity so
-- approval policies can distinguish semantically-different writes that share an
-- edge function — e.g. `charter-payouts-create` (user_approval) vs
-- `charter-payouts-approve` (admin_approval, money movement).
--
-- ADDITIVE ONLY: does not delete or modify existing edge.* rows.
-- Idempotent upsert keyed by tool_id. Safe to re-run.
--
-- Covers 111 action-level capabilities across 5 subsystems:
--   Eigen (27), Charter (29), Foundation (10), MEG (13), Oracle (32).

INSERT INTO public.tool_capabilities (
  tool_id, name, capability_tags, mode, approval_policy,
  role_requirements, connector_dependencies, blast_radius, fallback_mode
) VALUES
  -- ─── Eigen ───────────────────────────────────────────────────────────────
  ('eigen-chat', 'Eigen Internal Chat', '["search","read:knowledge","read:memory","write:memory","write:session","ai:synthesis"]'::jsonb, 'write', 'user_approval', '["member"]'::jsonb, '["supabase","openai"]'::jsonb, 'low', 'Returns snippet fallback if OpenAI unavailable; no-context message if no chunks retrieved'),
  ('eigen-chat-public', 'Eigen Public Chat', '["search","read:knowledge","ai:synthesis","public"]'::jsonb, 'read', 'none_required', '[]'::jsonb, '["supabase","openai"]'::jsonb, 'low', 'Snippet fallback if OpenAI unavailable; rate-limited by IP'),
  ('eigen-widget-chat', 'Eigen Widget Chat', '["search","read:knowledge","ai:synthesis","widget"]'::jsonb, 'read', 'none_required', '[]'::jsonb, '["supabase","openai"]'::jsonb, 'low', 'Snippet fallback; validates widget token + origin'),
  ('eigen-widget-session', 'Create Widget Session', '["write:session","widget"]'::jsonb, 'write', 'none_required', '[]'::jsonb, '["supabase"]'::jsonb, 'low', 'Rejects if site not in registry or origin not allowed; eigenx mode requires auth'),
  ('eigen-fetch-ingest', 'Eigen Fetch & Ingest (Web URL)', '["write:document","write:knowledge","ingest","fetch:web"]'::jsonb, 'write', 'user_approval', '["member"]'::jsonb, '["supabase","openai","external-web"]'::jsonb, 'medium', 'Fails if host not on allowlist; delegates to eigen-ingest'),
  ('eigen-ingest', 'Eigen Document Ingest', '["write:document","write:knowledge","write:embedding","ingest"]'::jsonb, 'write', 'user_approval', '["member"]'::jsonb, '["supabase","openai"]'::jsonb, 'medium', 'Idempotent replay on content-hash match; skips oracle outbox if disabled'),
  ('eigen-retrieve', 'Eigen Semantic Retrieve', '["search","read:knowledge"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase","openai"]'::jsonb, 'low', 'Returns empty chunks if no match; policy scope clamped per RBAC'),
  ('eigen-knowledge-chunks-read', 'Read Knowledge Chunks', '["read:knowledge"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('eigen-knowledge-chunks-create', 'Create Knowledge Chunk', '["write:knowledge"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Rejects with 400 on duplicate or invalid data'),
  ('eigen-knowledge-chunks-update', 'Update Knowledge Chunk', '["write:knowledge"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Rejects with 400 on invalid data'),
  ('eigen-memory-entries-read', 'Read Memory Entries', '["read:memory"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('eigen-memory-entries-recall', 'Recall Memory Entries', '["read:memory"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty entries array'),
  ('eigen-memory-entries-create', 'Create Memory Entry', '["write:memory"]'::jsonb, 'write', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on conflict'),
  ('eigen-memory-entries-upsert', 'Upsert Memory Entry', '["write:memory"]'::jsonb, 'write', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Upserts on scope+owner+key conflict'),
  ('eigen-memory-entries-update', 'Update Memory Entry', '["write:memory"]'::jsonb, 'write', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if entry not found or not owned by caller'),
  ('eigen-memory-entries-supersede', 'Supersede Memory Entry', '["write:memory"]'::jsonb, 'write', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if entry not found'),
  ('eigen-memory-entries-sweep', 'Sweep Stale Memory Entries', '["write:memory","admin:maintenance"]'::jsonb, 'write', 'user_approval', '["member"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Deletes expired entries; promotes short_term to long_term'),
  ('eigen-retrieval-runs-read', 'Read Retrieval Runs', '["read:retrieval"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('eigen-retrieval-runs-create', 'Create Retrieval Run', '["write:retrieval"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on invalid data'),
  ('eigen-retrieval-runs-complete', 'Complete Retrieval Run', '["write:retrieval"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if run not found'),
  ('eigen-retrieval-runs-fail', 'Fail Retrieval Run', '["write:retrieval"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if run not found'),
  ('eigen-oracle-outbox-drain', 'Drain Oracle Outbox', '["write:signal","write:knowledge","admin:pipeline"]'::jsonb, 'write', 'admin_approval', '["service_role"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Skips rows with no asset_registry target; atomic claim prevents double-processing'),
  ('eigen-public-sources', 'List Public Source Inventory', '["read:source-inventory","public"]'::jsonb, 'read', 'none_required', '[]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty inventory'),
  ('eigen-source-inventory', 'List All Source Inventory', '["read:source-inventory"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty inventory'),
  ('eigen-tool-capabilities-read', 'Read Tool Capabilities', '["read:tool-capability","read:policy"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Filters by policy scope; empty if no access'),
  ('eigen-tool-capabilities-create', 'Create Tool Capability', '["write:tool-capability","admin:config"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on duplicate or invalid data'),
  ('eigen-tool-capabilities-update', 'Update Tool Capability', '["write:tool-capability","admin:config"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),

  -- ─── Charter ─────────────────────────────────────────────────────────────
  ('charter-roles-read', 'Read Charter User Roles', '["read:role"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set if no roles assigned'),
  ('charter-roles-assign', 'Assign Charter Role', '["write:role","admin:role"]'::jsonb, 'write', 'admin_approval', '["admin"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Returns 400 on duplicate assignment'),
  ('charter-roles-update', 'Update Charter Role', '["write:role","admin:role"]'::jsonb, 'write', 'admin_approval', '["admin"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Returns 400 if not found'),
  ('charter-entities-read', 'Read Charter Entities', '["read:entity"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-entities-create', 'Create Charter Entity', '["write:entity"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('charter-entities-update', 'Update Charter Entity', '["write:entity"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('charter-rights-read', 'Read Charter Rights', '["read:right"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-rights-create', 'Create Charter Right', '["write:right"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('charter-rights-update', 'Update Charter Right', '["write:right"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('charter-obligations-read', 'Read Charter Obligations', '["read:obligation"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-obligations-create', 'Create Charter Obligation', '["write:obligation"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('charter-obligations-update', 'Update Charter Obligation', '["write:obligation"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('charter-evidence-read', 'Read Charter Evidence', '["read:evidence"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-evidence-create', 'Create Charter Evidence', '["write:evidence"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('charter-evidence-update', 'Update Charter Evidence', '["write:evidence"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('charter-governance-read', 'Read Governance Entities', '["read:governance"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-governance-create', 'Create Governance Entity', '["write:governance"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('charter-governance-update', 'Update Governance Entity', '["write:governance"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('charter-governance-transition', 'Transition Governance Entity Status', '["write:governance","admin:lifecycle"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Returns 400/404 if entity not found or transition invalid'),
  ('charter-decisions-read', 'Read Charter Decisions', '["read:decision"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-decisions-create', 'Create Charter Decision', '["write:decision"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('charter-decisions-update', 'Update Charter Decision', '["write:decision"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('charter-payouts-read', 'Read Charter Payouts', '["read:payout"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-payouts-create', 'Create Charter Payout', '["write:payout"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Returns 400 on invalid data'),
  ('charter-payouts-update', 'Update Charter Payout', '["write:payout"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Returns 400 if not found'),
  ('charter-payouts-approve', 'Approve Charter Payout', '["write:payout","admin:approval"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Returns 400 if not found or already approved'),
  ('charter-provenance-read', 'Read Provenance Events', '["read:provenance","read:audit"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-provenance-create', 'Append Provenance Event', '["write:provenance"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Immutable insert only; no PATCH or DELETE'),
  ('charter-audit-read', 'Read Audit Log', '["read:audit"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns paginated results'),
  ('charter-asset-valuations-read', 'Read Asset Valuations', '["read:valuation"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('charter-asset-valuations-create', 'Create Asset Valuation', '["write:valuation"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on missing required fields'),
  ('charter-asset-valuations-update', 'Update Asset Valuation', '["write:valuation"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),

  -- ─── Foundation ──────────────────────────────────────────────────────────
  ('foundation-asset-registry-read', 'Read Asset Registry', '["read:asset"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('foundation-asset-registry-create', 'Create Asset Registry Entry', '["write:asset"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on duplicate or invalid data'),
  ('foundation-asset-evidence-links-read', 'Read Asset Evidence Links', '["read:asset","read:evidence"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('foundation-asset-evidence-links-create', 'Create Asset Evidence Link', '["write:asset","write:evidence"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on duplicate'),
  ('foundation-asset-evidence-links-delete', 'Delete Asset Evidence Link', '["write:asset","write:evidence","delete"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('foundation-documents-read', 'Read Documents', '["read:document"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('foundation-documents-create', 'Create Document', '["write:document"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('foundation-documents-update', 'Update Document', '["write:document"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('foundation-documents-mark-indexed', 'Mark Document as Indexed', '["write:document","admin:pipeline"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if document not found'),
  ('foundation-documents-mark-embedded', 'Mark Document as Embedded', '["write:document","admin:pipeline"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if document not found'),

  -- ─── MEG (Master Entity Graph) ──────────────────────────────────────────
  ('meg-entities-read', 'Read MEG Entities', '["read:meg-entity"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('meg-entities-create', 'Create MEG Entity', '["write:meg-entity"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('meg-entities-update', 'Update MEG Entity', '["write:meg-entity"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Allowlist patch; returns 400 if not found'),
  ('meg-entities-merge', 'Merge MEG Entities', '["write:meg-entity","admin:lifecycle"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Sets source to merged status; returns 400 if not found'),
  ('meg-entities-archive', 'Archive MEG Entity', '["write:meg-entity","admin:lifecycle"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Sets status to archived; returns 400 if not found'),
  ('meg-entity-aliases-read', 'Read MEG Entity Aliases', '["read:meg-entity"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('meg-entity-aliases-resolve', 'Resolve MEG Entity Alias', '["read:meg-entity","search"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty if alias not found'),
  ('meg-entity-aliases-create', 'Create MEG Entity Alias', '["write:meg-entity"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on duplicate'),
  ('meg-entity-aliases-delete', 'Delete MEG Entity Alias', '["write:meg-entity","delete"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 if not found'),
  ('meg-entity-edges-read', 'Read MEG Entity Edges', '["read:meg-entity","read:graph"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('meg-entity-edges-create', 'Create MEG Entity Edge', '["write:meg-entity","write:graph"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on duplicate'),
  ('meg-entity-edges-update', 'Update MEG Entity Edge', '["write:meg-entity","write:graph"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Allowlist patch; returns 400 if not found'),
  ('meg-entity-edges-delete', 'Delete MEG Entity Edge', '["write:meg-entity","write:graph","delete"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),

  -- ─── Oracle ──────────────────────────────────────────────────────────────
  ('oracle-signals-read', 'Read Oracle Signals', '["read:signal"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Published scope by default; operator scope requires operator role'),
  ('oracle-signals-create', 'Create Oracle Signal', '["write:signal"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('oracle-signals-update', 'Update Oracle Signal', '["write:signal"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Allowlist patch; returns 400 if no patchable fields'),
  ('oracle-signals-publish', 'Publish Oracle Signal', '["write:signal","admin:publication"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Writes publication audit event; returns 400 if signal not found'),
  ('oracle-signals-approve', 'Approve Oracle Signal', '["write:signal","admin:publication"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Writes publication audit event'),
  ('oracle-signals-reject', 'Reject Oracle Signal', '["write:signal","admin:publication"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Writes publication audit event'),
  ('oracle-signals-defer', 'Defer Oracle Signal', '["write:signal","admin:publication"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Writes publication audit event'),
  ('oracle-signals-rescore', 'Rescore Oracle Signal', '["write:signal"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'In-place score refresh; returns 400 if not found'),
  ('oracle-theses-read', 'Read Oracle Theses', '["read:thesis"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Published scope by default; operator/mine scope available'),
  ('oracle-theses-create', 'Create Oracle Thesis', '["write:thesis"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('oracle-theses-update', 'Update Oracle Thesis', '["write:thesis"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Allowlist patch'),
  ('oracle-theses-publish', 'Publish Oracle Thesis', '["write:thesis","admin:publication"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Writes publication audit event'),
  ('oracle-theses-challenge', 'Challenge Oracle Thesis', '["write:thesis","admin:lifecycle"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Sets status to challenged'),
  ('oracle-theses-supersede', 'Supersede Oracle Thesis', '["write:thesis","admin:lifecycle"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Links superseding thesis'),
  ('oracle-evidence-items-read', 'Read Oracle Evidence Items', '["read:evidence"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('oracle-evidence-items-create', 'Create Oracle Evidence Item', '["write:evidence"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 on invalid data'),
  ('oracle-evidence-items-update', 'Update Oracle Evidence Item', '["write:evidence"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Allowlist patch'),
  ('oracle-source-packs-read', 'Read Oracle Source Packs', '["read:source-pack"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('oracle-source-packs-create', 'Create Oracle Source Pack', '["write:source-pack"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on invalid data'),
  ('oracle-thesis-evidence-links-read', 'Read Thesis-Evidence Links', '["read:thesis","read:evidence"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns empty set on no match'),
  ('oracle-thesis-evidence-links-create', 'Create Thesis-Evidence Link', '["write:thesis","write:evidence"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns 400 on duplicate'),
  ('oracle-thesis-evidence-links-delete', 'Delete Thesis-Evidence Link', '["write:thesis","write:evidence","delete"]'::jsonb, 'write', 'user_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Returns 400 if not found'),
  ('oracle-whitespace-runs-read', 'Read Oracle Whitespace Runs', '["read:whitespace","read:analysis"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns run with result envelope, decision, and outcome'),
  ('oracle-whitespace-runs-execute', 'Execute Oracle Whitespace Run', '["write:whitespace","write:analysis","ai:synthesis"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'high', 'Creates service layer run record'),
  ('oracle-whitespace-runs-decision', 'Upsert Oracle Run Decision', '["write:whitespace","admin:decision"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Upserts on run_id conflict; 404 if run not found'),
  ('oracle-whitespace-runs-outcome', 'Upsert Oracle Run Outcome', '["write:whitespace","admin:outcome"]'::jsonb, 'write', 'admin_approval', '["operator"]'::jsonb, '["supabase"]'::jsonb, 'medium', 'Upserts on run_id conflict; 404 if run not found'),
  ('oracle-read-models-briefings', 'Read Oracle Briefings', '["read:briefing","read:analysis"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns from materialized read-model view'),
  ('oracle-read-models-theme-map', 'Read Oracle Theme Map', '["read:theme-map","read:analysis"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns from materialized read-model view'),
  ('oracle-read-models-feed-history', 'Read Oracle Feed History', '["read:feed","read:analysis"]'::jsonb, 'read', 'none_required', '["member"]'::jsonb, '["supabase"]'::jsonb, 'low', 'Returns from materialized read-model view; supports since filter')
ON CONFLICT (tool_id) DO UPDATE SET
  name = EXCLUDED.name,
  capability_tags = EXCLUDED.capability_tags,
  mode = EXCLUDED.mode,
  approval_policy = EXCLUDED.approval_policy,
  role_requirements = EXCLUDED.role_requirements,
  connector_dependencies = EXCLUDED.connector_dependencies,
  blast_radius = EXCLUDED.blast_radius,
  fallback_mode = EXCLUDED.fallback_mode,
  updated_at = now();
