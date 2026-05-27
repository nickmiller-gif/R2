
-- ── Harden RLS on submission/batch tables ─────────────────────────

-- idea_submissions: revoke anon insert + open read; allow owner-only read
drop policy if exists "anon insert submissions" on public.idea_submissions;
drop policy if exists "anon read submissions" on public.idea_submissions;

create policy "owner reads own submissions"
on public.idea_submissions
for select
to authenticated
using (user_id = auth.uid());

create policy "admin reads all submissions"
on public.idea_submissions
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- validation_batches: revoke anon insert; keep public read (shareable status URL)
drop policy if exists "anon insert batches" on public.validation_batches;

-- batch_steps: revoke anon insert + update; keep public read
drop policy if exists "anon insert batch steps" on public.batch_steps;
drop policy if exists "anon update batch steps" on public.batch_steps;
;
