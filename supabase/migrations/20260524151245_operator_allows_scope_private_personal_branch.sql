create or replace function public.operator_allows_scope(_uid uuid, _scope text)
returns boolean
language sql
stable
security definer
set search_path = public, works
as $body$
  select exists (
    select 1 from works.operator_profiles op
    where op.user_id = _uid
      and op.active = true
      and (
        op.role::text = 'both'
        or _scope = 'both'
        or op.role::text = _scope
        or _scope = 'private_personal'
      )
  )
$body$;

create or replace function works.operator_allows_scope(_uid uuid, _row_scope text)
returns boolean
language sql
stable
security definer
set search_path = public, works
as $body$
  select exists (
    select 1 from works.operator_profiles op
    where op.user_id = _uid
      and op.active = true
      and (
        op.role::text = 'both'
        or _row_scope = 'both'
        or op.role::text = _row_scope
        or _row_scope = 'private_personal'
      )
  )
$body$;;
