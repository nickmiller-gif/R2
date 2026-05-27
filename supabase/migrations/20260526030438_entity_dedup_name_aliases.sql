create table if not exists public.name_aliases (
  canonical   text not null,
  alias       text not null,
  source      text not null default 'seed',
  created_at  timestamptz not null default now(),
  primary key (canonical, alias)
);

create index if not exists name_aliases_alias_idx on public.name_aliases (alias);

alter table public.name_aliases enable row level security;

drop policy if exists name_aliases_read_authenticated on public.name_aliases;
create policy name_aliases_read_authenticated
  on public.name_aliases for select
  to authenticated
  using (true);

insert into public.name_aliases (canonical, alias, source) values
  ('Alexander', 'alex', 'seed'), ('Alexander', 'al', 'seed'), ('Alexander', 'xander', 'seed'),
  ('Alex', 'alexander', 'seed'),
  ('Andrew', 'andy', 'seed'), ('Andrew', 'drew', 'seed'),
  ('Andy', 'andrew', 'seed'), ('Drew', 'andrew', 'seed'),
  ('Anthony', 'tony', 'seed'),
  ('Tony', 'anthony', 'seed'),
  ('Benjamin', 'ben', 'seed'), ('Benjamin', 'benny', 'seed'),
  ('Ben', 'benjamin', 'seed'),
  ('Bradley', 'brad', 'seed'),
  ('Brad', 'bradley', 'seed'),
  ('Catherine', 'cathy', 'seed'), ('Catherine', 'kate', 'seed'), ('Catherine', 'katie', 'seed'), ('Catherine', 'kathy', 'seed'),
  ('Cathy', 'catherine', 'seed'), ('Kate', 'catherine', 'seed'), ('Kate', 'katherine', 'seed'),
  ('Katherine', 'kate', 'seed'), ('Katherine', 'katie', 'seed'), ('Katherine', 'kathy', 'seed'),
  ('Charles', 'charlie', 'seed'), ('Charles', 'chuck', 'seed'),
  ('Charlie', 'charles', 'seed'), ('Chuck', 'charles', 'seed'),
  ('Christopher', 'chris', 'seed'),
  ('Chris', 'christopher', 'seed'),
  ('Daniel', 'dan', 'seed'), ('Daniel', 'danny', 'seed'),
  ('Dan', 'daniel', 'seed'), ('Danny', 'daniel', 'seed'),
  ('David', 'dave', 'seed'), ('David', 'davey', 'seed'),
  ('Dave', 'david', 'seed'),
  ('Deborah', 'debbie', 'seed'), ('Deborah', 'deb', 'seed'),
  ('Debbie', 'deborah', 'seed'),
  ('Donald', 'don', 'seed'), ('Donald', 'donnie', 'seed'),
  ('Don', 'donald', 'seed'),
  ('Douglas', 'doug', 'seed'),
  ('Doug', 'douglas', 'seed'),
  ('Edward', 'ed', 'seed'), ('Edward', 'eddie', 'seed'), ('Edward', 'ted', 'seed'),
  ('Ed', 'edward', 'seed'), ('Eddie', 'edward', 'seed'),
  ('Elizabeth', 'liz', 'seed'), ('Elizabeth', 'beth', 'seed'), ('Elizabeth', 'betty', 'seed'), ('Elizabeth', 'eliza', 'seed'),
  ('Liz', 'elizabeth', 'seed'), ('Beth', 'elizabeth', 'seed'), ('Betty', 'elizabeth', 'seed'),
  ('Francis', 'frank', 'seed'),
  ('Frank', 'francis', 'seed'), ('Frank', 'franklin', 'seed'),
  ('Franklin', 'frank', 'seed'),
  ('Frederick', 'fred', 'seed'), ('Frederick', 'freddie', 'seed'),
  ('Fred', 'frederick', 'seed'),
  ('Gerald', 'gerry', 'seed'), ('Gerald', 'jerry', 'seed'),
  ('Gerry', 'gerald', 'seed'),
  ('Gregory', 'greg', 'seed'),
  ('Greg', 'gregory', 'seed'),
  ('Henry', 'hank', 'seed'),
  ('Hank', 'henry', 'seed'),
  ('Isabella', 'bella', 'seed'), ('Isabella', 'izzy', 'seed'),
  ('Bella', 'isabella', 'seed'),
  ('Jacob', 'jake', 'seed'),
  ('Jake', 'jacob', 'seed'),
  ('James', 'jim', 'seed'), ('James', 'jimmy', 'seed'), ('James', 'jamie', 'seed'),
  ('Jim', 'james', 'seed'), ('Jimmy', 'james', 'seed'),
  ('Jennifer', 'jen', 'seed'), ('Jennifer', 'jenny', 'seed'), ('Jennifer', 'jenn', 'seed'),
  ('Jen', 'jennifer', 'seed'), ('Jenny', 'jennifer', 'seed'),
  ('Jeffrey', 'jeff', 'seed'),
  ('Jeff', 'jeffrey', 'seed'),
  ('Jerome', 'jerry', 'seed'),
  ('Jerry', 'gerald', 'seed'), ('Jerry', 'jerome', 'seed'),
  ('Jessica', 'jess', 'seed'), ('Jessica', 'jessie', 'seed'),
  ('Jess', 'jessica', 'seed'),
  ('John', 'jack', 'seed'), ('John', 'johnny', 'seed'),
  ('Jack', 'john', 'seed'), ('Jack', 'jackson', 'seed'),
  ('Jonathan', 'jon', 'seed'), ('Jonathan', 'john', 'seed'),
  ('Jon', 'jonathan', 'seed'),
  ('Joseph', 'joe', 'seed'), ('Joseph', 'joey', 'seed'),
  ('Joe', 'joseph', 'seed'),
  ('Joshua', 'josh', 'seed'),
  ('Josh', 'joshua', 'seed'),
  ('Kenneth', 'ken', 'seed'), ('Kenneth', 'kenny', 'seed'),
  ('Ken', 'kenneth', 'seed'),
  ('Kimberly', 'kim', 'seed'),
  ('Kim', 'kimberly', 'seed'),
  ('Lawrence', 'larry', 'seed'),
  ('Larry', 'lawrence', 'seed'),
  ('Leonard', 'leo', 'seed'), ('Leonard', 'lenny', 'seed'),
  ('Leo', 'leonard', 'seed'),
  ('Margaret', 'meg', 'seed'), ('Margaret', 'maggie', 'seed'), ('Margaret', 'peggy', 'seed'),
  ('Maggie', 'margaret', 'seed'), ('Meg', 'margaret', 'seed'),
  ('Matthew', 'matt', 'seed'), ('Matthew', 'matty', 'seed'),
  ('Matt', 'matthew', 'seed'),
  ('Michael', 'mike', 'seed'), ('Michael', 'mikey', 'seed'),
  ('Mike', 'michael', 'seed'),
  ('Nathaniel', 'nate', 'seed'),
  ('Nate', 'nathaniel', 'seed'), ('Nate', 'nathan', 'seed'),
  ('Nathan', 'nate', 'seed'),
  ('Nicholas', 'nick', 'seed'), ('Nicholas', 'nicky', 'seed'),
  ('Nick', 'nicholas', 'seed'),
  ('Patricia', 'pat', 'seed'), ('Patricia', 'patty', 'seed'), ('Patricia', 'trish', 'seed'),
  ('Patrick', 'pat', 'seed'),
  ('Pat', 'patricia', 'seed'),
  ('Peter', 'pete', 'seed'),
  ('Pete', 'peter', 'seed'),
  ('Rachel', 'rae', 'seed'),
  ('Raymond', 'ray', 'seed'), ('Raymond', 'raymie', 'seed'),
  ('Ray', 'raymond', 'seed'),
  ('Rebecca', 'becky', 'seed'), ('Rebecca', 'becca', 'seed'),
  ('Becky', 'rebecca', 'seed'),
  ('Richard', 'rick', 'seed'), ('Richard', 'dick', 'seed'), ('Richard', 'rich', 'seed'), ('Richard', 'ricky', 'seed'),
  ('Rick', 'richard', 'seed'), ('Rich', 'richard', 'seed'),
  ('Robert', 'rob', 'seed'), ('Robert', 'bob', 'seed'), ('Robert', 'bobby', 'seed'), ('Robert', 'robbie', 'seed'),
  ('Rob', 'robert', 'seed'), ('Bob', 'robert', 'seed'),
  ('Ronald', 'ron', 'seed'), ('Ronald', 'ronnie', 'seed'),
  ('Ron', 'ronald', 'seed'),
  ('Samuel', 'sam', 'seed'), ('Samuel', 'sammy', 'seed'),
  ('Sam', 'samuel', 'seed'), ('Sam', 'samantha', 'seed'),
  ('Samantha', 'sam', 'seed'), ('Samantha', 'sammy', 'seed'),
  ('Stephen', 'steve', 'seed'), ('Stephen', 'stevie', 'seed'),
  ('Steven', 'steve', 'seed'),
  ('Steve', 'stephen', 'seed'), ('Steve', 'steven', 'seed'),
  ('Susan', 'sue', 'seed'), ('Susan', 'susie', 'seed'),
  ('Sue', 'susan', 'seed'),
  ('Theodore', 'ted', 'seed'), ('Theodore', 'teddy', 'seed'),
  ('Ted', 'theodore', 'seed'), ('Ted', 'edward', 'seed'),
  ('Thomas', 'tom', 'seed'), ('Thomas', 'tommy', 'seed'),
  ('Tom', 'thomas', 'seed'),
  ('Timothy', 'tim', 'seed'), ('Timothy', 'timmy', 'seed'),
  ('Tim', 'timothy', 'seed'),
  ('Vincent', 'vince', 'seed'), ('Vincent', 'vinny', 'seed'),
  ('Vince', 'vincent', 'seed'),
  ('Virginia', 'ginny', 'seed'), ('Virginia', 'ginger', 'seed'),
  ('William', 'will', 'seed'), ('William', 'bill', 'seed'), ('William', 'billy', 'seed'), ('William', 'willie', 'seed'),
  ('Will', 'william', 'seed'), ('Bill', 'william', 'seed'),
  ('Zachary', 'zach', 'seed'), ('Zachary', 'zack', 'seed'),
  ('Zach', 'zachary', 'seed'), ('Zack', 'zachary', 'seed')
on conflict (canonical, alias) do nothing;

create or replace function public.normalize_first_token(p_input text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  with first_tok as (
    select lower(coalesce(
      (regexp_split_to_array(trim(coalesce(p_input, '')), '\s+'))[1],
      ''
    )) as t
  )
  select coalesce(
    (select lower(a.canonical) from public.name_aliases a, first_tok f
       where lower(a.alias) = f.t limit 1),
    (select f.t from first_tok f)
  );
$body$;

revoke execute on function public.normalize_first_token(text) from public;
grant  execute on function public.normalize_first_token(text) to authenticated, service_role;

drop function if exists public.find_entity_dedup_candidates(float, int);

create or replace function public.find_entity_dedup_candidates(
  p_threshold float default 0.6,
  p_max       int   default 200
)
returns table (
  pair_kind     text,
  a_id          uuid,
  a_name        text,
  a_entity_type text,
  a_works_count int,
  a_public_count int,
  b_id          uuid,
  b_name        text,
  b_entity_type text,
  b_works_count int,
  b_public_count int,
  similarity    float
)
language sql
stable
security definer
set search_path = public, works, extensions, pg_temp
as $body$
  with active as (
    select id, canonical_name, entity_type,
           public.normalize_first_token(canonical_name) as norm_first
    from public.meg_entities
    where status = 'active'
  ),
  ref_counts as (
    select
      m.id,
      (select count(*) from works.entities w where w.meg_entity_id = m.id) as works_count,
      (select count(*) from public.entities e where e.meg_entity_id = m.id::text) as public_count
    from active m
  ),
  exact_pairs as (
    select 'exact'::text as pair_kind, a.id as a_id, b.id as b_id, 1.0::float as similarity
    from active a
    join active b on a.canonical_name = b.canonical_name and a.id < b.id
  ),
  fuzzy_pairs as (
    select 'fuzzy'::text as pair_kind, a.id as a_id, b.id as b_id,
           similarity(a.canonical_name, b.canonical_name)::float as similarity
    from active a
    join active b on a.id < b.id
    where a.canonical_name <> b.canonical_name
      and char_length(a.canonical_name) >= 3
      and char_length(b.canonical_name) >= 3
      and a.canonical_name % b.canonical_name
      and similarity(a.canonical_name, b.canonical_name) >= p_threshold
  ),
  alias_pairs as (
    select 'alias'::text as pair_kind, a.id as a_id, b.id as b_id,
           coalesce(similarity(a.canonical_name, b.canonical_name)::float, 0.0) as similarity
    from active a
    join active b
      on a.id < b.id
     and a.norm_first = b.norm_first
     and a.norm_first <> ''
    where a.canonical_name <> b.canonical_name
      and not exists (
        select 1 from fuzzy_pairs f where f.a_id = a.id and f.b_id = b.id
      )
  ),
  all_pairs as (
    select * from exact_pairs
    union all
    select * from fuzzy_pairs
    union all
    select * from alias_pairs
  )
  select
    p.pair_kind,
    a.id, a.canonical_name, a.entity_type::text, ac.works_count::int, ac.public_count::int,
    b.id, b.canonical_name, b.entity_type::text, bc.works_count::int, bc.public_count::int,
    p.similarity
  from all_pairs p
  join active a on a.id = p.a_id
  join active b on b.id = p.b_id
  join ref_counts ac on ac.id = a.id
  join ref_counts bc on bc.id = b.id
  order by
    case p.pair_kind when 'exact' then 0 when 'alias' then 1 else 2 end,
    p.similarity desc
  limit greatest(1, least(coalesce(p_max, 200), 1000));
$body$;

revoke execute on function public.find_entity_dedup_candidates(float, int) from anon, authenticated, public;
grant  execute on function public.find_entity_dedup_candidates(float, int) to authenticated, service_role;;
