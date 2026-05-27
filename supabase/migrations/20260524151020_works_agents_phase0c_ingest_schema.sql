create table if not exists works.email_calendar_ingest_runs (
  id                 uuid primary key default gen_random_uuid(),
  operator_user_id   uuid not null references auth.users(id) on delete cascade,
  source_system      text not null
                     check (source_system in ('manual_upload', 'm365', 'google_workspace')),
  source_format      text not null
                     check (source_format in ('eml', 'mbox', 'ics', 'json')),
  status             text not null default 'pending'
                     check (status in ('pending','running','succeeded','failed','cancelled')),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  messages_count     integer not null default 0,
  events_count       integer not null default 0,
  error              text,
  governance_scope   text not null default 'commercial'
                     check (governance_scope in ('foundation','commercial','both')),
  payload            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint email_calendar_ingest_runs_completed_at_after_started
    check (completed_at is null or completed_at >= started_at)
);

create index if not exists email_calendar_ingest_runs_operator_started_idx
  on works.email_calendar_ingest_runs (operator_user_id, started_at desc);
create index if not exists email_calendar_ingest_runs_status_idx
  on works.email_calendar_ingest_runs (status, started_at desc);

drop trigger if exists email_calendar_ingest_runs_set_updated_at on works.email_calendar_ingest_runs;
create trigger email_calendar_ingest_runs_set_updated_at
  before update on works.email_calendar_ingest_runs
  for each row execute function works.set_updated_at();

create table if not exists works.email_messages (
  id                              uuid primary key default gen_random_uuid(),
  ingest_run_id                   uuid not null references works.email_calendar_ingest_runs(id) on delete cascade,
  operator_user_id                uuid not null references auth.users(id) on delete cascade,
  source_system                   text not null,
  source_message_id               text,
  thread_id                       text,
  from_address                    text not null,
  from_name                       text,
  to_addresses                    text[] not null default '{}',
  cc_addresses                    text[] not null default '{}',
  bcc_addresses                   text[] not null default '{}',
  subject                         text,
  body_text                       text,
  body_html                       text,
  sent_at                         timestamptz,
  received_at                     timestamptz,
  attachments_json                jsonb not null default '[]'::jsonb,
  payload                         jsonb not null default '{}'::jsonb,
  resolved_actor_meg_entity_id    uuid references public.meg_entities(id) on delete set null,
  resolved_related_meg_entity_ids uuid[] not null default '{}',
  processed_at                    timestamptz,
  processing_status               text not null default 'pending'
                                  check (processing_status in ('pending','resolved','failed','skipped')),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists email_messages_operator_sent_idx
  on works.email_messages (operator_user_id, sent_at desc);
create index if not exists email_messages_ingest_run_idx
  on works.email_messages (ingest_run_id);
create index if not exists email_messages_resolved_actor_idx
  on works.email_messages (resolved_actor_meg_entity_id)
  where resolved_actor_meg_entity_id is not null;
create index if not exists email_messages_processing_status_idx
  on works.email_messages (processing_status)
  where processing_status = 'pending';
create unique index if not exists email_messages_source_idempotent_uniq
  on works.email_messages (operator_user_id, source_system, source_message_id)
  where source_message_id is not null;

drop trigger if exists email_messages_set_updated_at on works.email_messages;
create trigger email_messages_set_updated_at
  before update on works.email_messages
  for each row execute function works.set_updated_at();

create table if not exists works.calendar_events (
  id                                 uuid primary key default gen_random_uuid(),
  ingest_run_id                      uuid not null references works.email_calendar_ingest_runs(id) on delete cascade,
  operator_user_id                   uuid not null references auth.users(id) on delete cascade,
  source_system                      text not null,
  source_event_id                    text,
  summary                            text,
  description                        text,
  location                           text,
  start_at                           timestamptz not null,
  end_at                             timestamptz,
  organizer_email                    text,
  organizer_name                     text,
  attendee_emails                    text[] not null default '{}',
  attendee_names                     text[] not null default '{}',
  is_recurring                       boolean not null default false,
  recurrence_rule                    text,
  payload                            jsonb not null default '{}'::jsonb,
  resolved_organizer_meg_entity_id   uuid references public.meg_entities(id) on delete set null,
  resolved_attendee_meg_entity_ids   uuid[] not null default '{}',
  processed_at                       timestamptz,
  processing_status                  text not null default 'pending'
                                     check (processing_status in ('pending','resolved','failed','skipped')),
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now(),
  constraint calendar_events_end_at_after_start
    check (end_at is null or end_at >= start_at)
);

create index if not exists calendar_events_operator_start_idx
  on works.calendar_events (operator_user_id, start_at desc);
create index if not exists calendar_events_ingest_run_idx
  on works.calendar_events (ingest_run_id);
create index if not exists calendar_events_resolved_organizer_idx
  on works.calendar_events (resolved_organizer_meg_entity_id)
  where resolved_organizer_meg_entity_id is not null;
create index if not exists calendar_events_processing_status_idx
  on works.calendar_events (processing_status)
  where processing_status = 'pending';
create unique index if not exists calendar_events_source_idempotent_uniq
  on works.calendar_events (operator_user_id, source_system, source_event_id)
  where source_event_id is not null;

drop trigger if exists calendar_events_set_updated_at on works.calendar_events;
create trigger calendar_events_set_updated_at
  before update on works.calendar_events
  for each row execute function works.set_updated_at();

alter table works.email_calendar_ingest_runs enable row level security;
grant select on works.email_calendar_ingest_runs to authenticated;
revoke insert, update, delete on works.email_calendar_ingest_runs from authenticated;

drop policy if exists email_calendar_ingest_runs_select on works.email_calendar_ingest_runs;
create policy email_calendar_ingest_runs_select on works.email_calendar_ingest_runs
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists email_calendar_ingest_runs_insert on works.email_calendar_ingest_runs;
create policy email_calendar_ingest_runs_insert on works.email_calendar_ingest_runs
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and works.operator_allows_scope(auth.uid(), governance_scope)
  );

drop policy if exists email_calendar_ingest_runs_update on works.email_calendar_ingest_runs;
create policy email_calendar_ingest_runs_update on works.email_calendar_ingest_runs
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and works.operator_allows_scope(auth.uid(), governance_scope)
  );

alter table works.email_messages enable row level security;
grant select on works.email_messages to authenticated;
revoke insert, update, delete on works.email_messages from authenticated;

drop policy if exists email_messages_select on works.email_messages;
create policy email_messages_select on works.email_messages
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists email_messages_insert on works.email_messages;
create policy email_messages_insert on works.email_messages
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and exists (
      select 1 from works.email_calendar_ingest_runs r
      where r.id = ingest_run_id
        and r.operator_user_id = auth.uid()
    )
  );

drop policy if exists email_messages_update on works.email_messages;
create policy email_messages_update on works.email_messages
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and exists (
      select 1 from works.email_calendar_ingest_runs r
      where r.id = ingest_run_id
        and r.operator_user_id = auth.uid()
    )
  );

alter table works.calendar_events enable row level security;
grant select on works.calendar_events to authenticated;
revoke insert, update, delete on works.calendar_events from authenticated;

drop policy if exists calendar_events_select on works.calendar_events;
create policy calendar_events_select on works.calendar_events
  for select to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  );

drop policy if exists calendar_events_insert on works.calendar_events;
create policy calendar_events_insert on works.calendar_events
  for insert to authenticated
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and exists (
      select 1 from works.email_calendar_ingest_runs r
      where r.id = ingest_run_id
        and r.operator_user_id = auth.uid()
    )
  );

drop policy if exists calendar_events_update on works.calendar_events;
create policy calendar_events_update on works.calendar_events
  for update to authenticated
  using (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
  )
  with check (
    public.is_active_operator(auth.uid())
    and operator_user_id = auth.uid()
    and exists (
      select 1 from works.email_calendar_ingest_runs r
      where r.id = ingest_run_id
        and r.operator_user_id = auth.uid()
    )
  );;
