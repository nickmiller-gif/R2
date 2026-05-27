create index if not exists meg_entities_external_primary_email_idx
  on public.meg_entities ((lower(external_ids->>'primary_email')))
  where entity_type = 'person'
    and status = 'active'
    and external_ids ? 'primary_email';

create index if not exists meg_entities_external_email_idx
  on public.meg_entities ((lower(external_ids->>'email')))
  where entity_type = 'person'
    and status = 'active'
    and external_ids ? 'email';

comment on index public.meg_entities_external_primary_email_idx is
  'Phase 0C-iii: speeds up the email→entity lookup in works.lookup_meg_entities_by_emails.';
comment on index public.meg_entities_external_email_idx is
  'Phase 0C-iii: legacy external_ids.email fallback for the email→entity lookup.';

create or replace function works.lookup_meg_entities_by_emails(p_emails text[])
returns table (
  email text,
  meg_entity_id uuid
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $body$
  select
    matched_email as email,
    e.id          as meg_entity_id
  from public.meg_entities e
  cross join lateral (
    select v from (
      values
        (lower(e.external_ids->>'primary_email')),
        (lower(e.external_ids->>'email'))
    ) as t(v)
    where v is not null
      and v = any(p_emails)
  ) matched(matched_email)
  where e.entity_type = 'person'
    and e.status = 'active'
$body$;

grant execute on function works.lookup_meg_entities_by_emails(text[]) to authenticated, service_role;

comment on function works.lookup_meg_entities_by_emails(text[]) is
  'Phase 0C-iii: bulk email→meg_entities.id lookup using the lower(external_ids->>...) indexes. Returns one row per matched (email, entity) tuple; misses are absent.';

create unique index if not exists meg_entity_source_refs_natural_key_uniq
  on public.meg_entity_source_refs (meg_entity_id, source_table, source_row_id);

comment on index public.meg_entity_source_refs_natural_key_uniq is
  'Phase 0C-iii: natural-key uniqueness so the resolver can use onConflict.ignoreDuplicates safely under concurrent invocations.';;
