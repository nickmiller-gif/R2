-- Upgrade operator_plan_sections to support distinct operator +
-- counsel review tracks. Pre-existing `review_status` /
-- `reviewed_by` / `reviewed_at` columns stay for backwards-compat
-- (legacy single-reviewer surface).
--
-- New columns:
--   operator_review_status / operator_reviewed_by / operator_reviewed_at
--   counsel_review_status  / counsel_reviewed_by  / counsel_reviewed_at
--   review_prompts jsonb — structured per-reviewer prompts
--
-- review_prompts shape:
--   { "operator": ["...", "..."], "counsel": ["...", "..."] }
-- Renderer surfaces these as "what to check" checklists alongside
-- each reviewer's status pill.

alter table public.operator_plan_sections
  add column if not exists operator_review_status text not null default 'draft',
  add column if not exists operator_reviewed_by uuid,
  add column if not exists operator_reviewed_at timestamptz,
  add column if not exists counsel_review_status text not null default 'draft',
  add column if not exists counsel_reviewed_by uuid,
  add column if not exists counsel_reviewed_at timestamptz,
  add column if not exists review_prompts jsonb not null default '{}'::jsonb;

-- CHECK constraints to keep status values consistent with the
-- legacy review_status enum semantics
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'operator_plan_sections_operator_review_status_check') then
    alter table public.operator_plan_sections
      add constraint operator_plan_sections_operator_review_status_check
      check (operator_review_status in ('draft','needs_review','reviewed','approved','needs_changes','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'operator_plan_sections_counsel_review_status_check') then
    alter table public.operator_plan_sections
      add constraint operator_plan_sections_counsel_review_status_check
      check (counsel_review_status in ('draft','needs_review','reviewed','approved','needs_changes','archived'));
  end if;
end $$;

comment on column public.operator_plan_sections.operator_review_status is
  'Operator''s independent sign-off track. Separate from counsel_review_status so the two reviewers can move at different speeds.';
comment on column public.operator_plan_sections.counsel_review_status is
  'Counsel''s independent sign-off track. Same enum as operator_review_status. A section reaches "fully approved" only when BOTH tracks are approved.';
comment on column public.operator_plan_sections.review_prompts is
  'Structured review checklist per reviewer role. Shape: { "operator": ["..."], "counsel": ["..."] }. Renders as "what to check" lists next to each status pill so reviewers know what they''re signing off on.';;
