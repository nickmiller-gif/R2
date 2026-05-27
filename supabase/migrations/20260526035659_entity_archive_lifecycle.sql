create or replace function public.archive_meg_entity(
  p_id     uuid,
  p_reason text default null
)
returns table (meg_id uuid, prior_name text, reason text)
language plpgsql
security definer
set search_path = public, works, pg_temp
as $body$
declare
  v_row public.meg_entities%rowtype;
  v_reason text;
begin
  if p_id is null then raise exception 'archive_meg_entity: id must be non-null'; end if;
  select * into v_row from public.meg_entities where id = p_id;
  if not found then raise exception 'archive_meg_entity: meg entity % not found', p_id; end if;
  if v_row.status = 'archived' then raise exception 'archive_meg_entity: meg entity % already archived', p_id; end if;
  if v_row.status = 'merged' then raise exception 'archive_meg_entity: cannot archive merged entity % (already merged into %)', p_id, v_row.merged_into_id; end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  update public.meg_entities
  set status = 'archived'::public.meg_entity_status,
      updated_at = now(),
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{archive_log}',
        coalesce(metadata -> 'archive_log', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object(
              'action', 'archive',
              'at', now(),
              'prior_status', v_row.status::text,
              'reason', v_reason
            ))
      )
  where id = p_id;

  return query select p_id, v_row.canonical_name, v_reason;
end;
$body$;

revoke execute on function public.archive_meg_entity(uuid, text) from anon, authenticated, public;
grant  execute on function public.archive_meg_entity(uuid, text) to service_role;

create or replace function public.unarchive_meg_entity(p_id uuid)
returns table (meg_id uuid, restored_name text)
language plpgsql
security definer
set search_path = public, works, pg_temp
as $body$
declare
  v_row public.meg_entities%rowtype;
begin
  if p_id is null then raise exception 'unarchive_meg_entity: id must be non-null'; end if;
  select * into v_row from public.meg_entities where id = p_id;
  if not found then raise exception 'unarchive_meg_entity: meg entity % not found', p_id; end if;
  if v_row.status <> 'archived' then raise exception 'unarchive_meg_entity: meg entity % is not archived (status=%)', p_id, v_row.status; end if;

  update public.meg_entities
  set status = 'active'::public.meg_entity_status,
      updated_at = now(),
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{archive_log}',
        coalesce(metadata -> 'archive_log', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object(
              'action', 'unarchive',
              'at', now()
            ))
      )
  where id = p_id;

  return query select p_id, v_row.canonical_name;
end;
$body$;

revoke execute on function public.unarchive_meg_entity(uuid) from anon, authenticated, public;
grant  execute on function public.unarchive_meg_entity(uuid) to service_role;;
