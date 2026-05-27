-- M10: add confidence_reasoning to legislation_obligation_atoms
--
-- CodeRabbit's Option D from PR #110: capture WHY the LLM picked a
-- given confidence value alongside the value itself. Makes inference-
-- depth assessment auditable in the drill-down UI (uniform rationales
-- across atoms are an obvious red flag for anchoring, even more
-- visible than uniform numeric scores).
--
-- Nullable so the existing 10 pre-fix atoms (all at 0.95) can stay
-- without backfill. New atoms from any post-deploy ingest run will
-- populate it via the updated atom_extractor system prompt.

alter table works.legislation_obligation_atoms
  add column if not exists confidence_reasoning text;

comment on column works.legislation_obligation_atoms.confidence_reasoning is
  'LLM-generated rationale for the confidence value on this atom (e.g. "actor named in § 4(a); threshold computed from § 7(b)"). NULL for pre-2026-05-26 atoms extracted before this column existed.';;
