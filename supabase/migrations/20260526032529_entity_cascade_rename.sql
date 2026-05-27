create or replace function public.meg_entities_rename_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, works, pg_temp
as $body$
declare
  v_works_renamed int := 0;
  v_public_renamed int := 0;
begin
  if NEW.canonical_name is null
     or OLD.canonical_name is null
     or NEW.canonical_name = OLD.canonical_name then
    return NEW;
  end if;

  if current_setting('app.entity_sync_in_progress', true) = 'on' then
    return NEW;
  end if;
  perform set_config('app.entity_sync_in_progress', 'on', true);

  update works.entities
  set label = NEW.canonical_name
  where meg_entity_id = NEW.id
    and label is distinct from NEW.canonical_name;
  get diagnostics v_works_renamed = row_count;

  update public.entities
  set name = NEW.canonical_name,
      updated_at = now()
  where meg_entity_id = NEW.id::text
    and name is distinct from NEW.canonical_name;
  get diagnostics v_public_renamed = row_count;

  update public.meg_entities
  set metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{rename_log}',
        coalesce(metadata -> 'rename_log', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object(
              'from', OLD.canonical_name,
              'to', NEW.canonical_name,
              'at', now(),
              'works_renamed', v_works_renamed,
              'public_renamed', v_public_renamed
            ))
      ),
      updated_at = now()
  where id = NEW.id;

  perform set_config('app.entity_sync_in_progress', 'off', true);
  return NEW;
end;
$body$;

drop trigger if exists trg_meg_entities_rename_propagate on public.meg_entities;
create trigger trg_meg_entities_rename_propagate
  after update of canonical_name on public.meg_entities
  for each row
  execute function public.meg_entities_rename_after_update();

revoke execute on function public.meg_entities_rename_after_update() from anon, authenticated, public;

create or replace function public.rename_meg_entity(
  p_id       uuid,
  p_new_name text
)
returns table (
  meg_id           uuid,
  old_name         text,
  new_name         text,
  works_renamed    int,
  public_renamed   int
)
language plpgsql
security definer
set search_path = public, works, pg_temp
as $body$
declare
  v_row public.meg_entities%rowtype;
  v_old text;
  v_new text;
  v_works_count int := 0;
  v_public_count int := 0;
begin
  if p_id is null then
    raise exception 'rename_meg_entity: id must be non-null';
  end if;
  v_new := nullif(btrim(coalesce(p_new_name, '')), '');
  if v_new is null then
    raise exception 'rename_meg_entity: new name cannot be empty';
  end if;
  if length(v_new) > 500 then
    raise exception 'rename_meg_entity: new name too long (% chars)', length(v_new);
  end if;

  select * into v_row from public.meg_entities where id = p_id;
  if not found then
    raise exception 'rename_meg_entity: meg entity % not found', p_id;
  end if;
  if v_row.status = 'merged' then
    raise exception 'rename_meg_entity: cannot rename merged entity %', p_id;
  end if;
  v_old := v_row.canonical_name;
  if v_old = v_new then
    return query select v_row.id, v_old, v_new, 0, 0;
    return;
  end if;

  update public.meg_entities
  set canonical_name = v_new,
      updated_at = now()
  where id = p_id;

  select
    coalesce((m.metadata -> 'rename_log' -> -1 ->> 'works_renamed')::int, 0),
    coalesce((m.metadata -> 'rename_log' -> -1 ->> 'public_renamed')::int, 0)
  into v_works_count, v_public_count
  from public.meg_entities m
  where m.id = p_id;

  return query select p_id, v_old, v_new, v_works_count, v_public_count;
end;
$body$;

revoke execute on function public.rename_meg_entity(uuid, text) from anon, authenticated, public;
grant  execute on function public.rename_meg_entity(uuid, text) to service_role;;
