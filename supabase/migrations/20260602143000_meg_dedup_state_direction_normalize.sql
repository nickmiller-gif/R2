-- Harden property dedup: US state names → 2-letter codes; street directionals (N → north).

begin;

create or replace function public.meg_normalize_us_state(p_state text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  with cleaned as (
    select upper(regexp_replace(coalesce(p_state, ''), '[^a-zA-Z]', '', 'g')) as s
  )
  select case
    when (select s from cleaned) = '' then ''
    when length((select s from cleaned)) = 2 then (select s from cleaned)
    when (select s from cleaned) = 'ALABAMA' then 'AL'
    when (select s from cleaned) = 'ALASKA' then 'AK'
    when (select s from cleaned) = 'ARIZONA' then 'AZ'
    when (select s from cleaned) = 'ARKANSAS' then 'AR'
    when (select s from cleaned) = 'CALIFORNIA' then 'CA'
    when (select s from cleaned) = 'COLORADO' then 'CO'
    when (select s from cleaned) = 'CONNECTICUT' then 'CT'
    when (select s from cleaned) = 'DELAWARE' then 'DE'
    when (select s from cleaned) = 'FLORIDA' then 'FL'
    when (select s from cleaned) = 'GEORGIA' then 'GA'
    when (select s from cleaned) = 'HAWAII' then 'HI'
    when (select s from cleaned) = 'IDAHO' then 'ID'
    when (select s from cleaned) = 'ILLINOIS' then 'IL'
    when (select s from cleaned) = 'INDIANA' then 'IN'
    when (select s from cleaned) = 'IOWA' then 'IA'
    when (select s from cleaned) = 'KANSAS' then 'KS'
    when (select s from cleaned) = 'KENTUCKY' then 'KY'
    when (select s from cleaned) = 'LOUISIANA' then 'LA'
    when (select s from cleaned) = 'MAINE' then 'ME'
    when (select s from cleaned) = 'MARYLAND' then 'MD'
    when (select s from cleaned) = 'MASSACHUSETTS' then 'MA'
    when (select s from cleaned) = 'MICHIGAN' then 'MI'
    when (select s from cleaned) = 'MINNESOTA' then 'MN'
    when (select s from cleaned) = 'MISSISSIPPI' then 'MS'
    when (select s from cleaned) = 'MISSOURI' then 'MO'
    when (select s from cleaned) = 'MONTANA' then 'MT'
    when (select s from cleaned) = 'NEBRASKA' then 'NE'
    when (select s from cleaned) = 'NEVADA' then 'NV'
    when (select s from cleaned) = 'NEWHAMPSHIRE' then 'NH'
    when (select s from cleaned) = 'NEWJERSEY' then 'NJ'
    when (select s from cleaned) = 'NEWMEXICO' then 'NM'
    when (select s from cleaned) = 'NEWYORK' then 'NY'
    when (select s from cleaned) = 'NORTHCAROLINA' then 'NC'
    when (select s from cleaned) = 'NORTHDAKOTA' then 'ND'
    when (select s from cleaned) = 'OHIO' then 'OH'
    when (select s from cleaned) = 'OKLAHOMA' then 'OK'
    when (select s from cleaned) = 'OREGON' then 'OR'
    when (select s from cleaned) = 'PENNSYLVANIA' then 'PA'
    when (select s from cleaned) = 'RHODEISLAND' then 'RI'
    when (select s from cleaned) = 'SOUTHCAROLINA' then 'SC'
    when (select s from cleaned) = 'SOUTHDAKOTA' then 'SD'
    when (select s from cleaned) = 'TENNESSEE' then 'TN'
    when (select s from cleaned) = 'TEXAS' then 'TX'
    when (select s from cleaned) = 'UTAH' then 'UT'
    when (select s from cleaned) = 'VERMONT' then 'VT'
    when (select s from cleaned) = 'VIRGINIA' then 'VA'
    when (select s from cleaned) = 'WASHINGTON' then 'WA'
    when (select s from cleaned) = 'WESTVIRGINIA' then 'WV'
    when (select s from cleaned) = 'WISCONSIN' then 'WI'
    when (select s from cleaned) = 'WYOMING' then 'WY'
    when (select s from cleaned) = 'DISTRICTOFCOLUMBIA' then 'DC'
    else left((select s from cleaned), 2)
  end;
$body$;

create or replace function public.meg_expand_street_tokens(p_input text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
declare
  v text := coalesce(p_input, '');
begin
  v := regexp_replace(v, '\mnorthwest\M', 'northwest', 'gi');
  v := regexp_replace(v, '\mnw\M', 'northwest', 'gi');
  v := regexp_replace(v, '\mnortheast\M', 'northeast', 'gi');
  v := regexp_replace(v, '\mne\M', 'northeast', 'gi');
  v := regexp_replace(v, '\msoutheast\M', 'southeast', 'gi');
  v := regexp_replace(v, '\mse\M', 'southeast', 'gi');
  v := regexp_replace(v, '\msouthwest\M', 'southwest', 'gi');
  v := regexp_replace(v, '\msw\M', 'southwest', 'gi');
  v := regexp_replace(v, '\mnorth\M', 'north', 'gi');
  v := regexp_replace(v, '\msouth\M', 'south', 'gi');
  v := regexp_replace(v, '\meast\M', 'east', 'gi');
  v := regexp_replace(v, '\mwest\M', 'west', 'gi');
  v := regexp_replace(v, '\mn\M', 'north', 'gi');
  v := regexp_replace(v, '\ms\M', 'south', 'gi');
  v := regexp_replace(v, '\me\M', 'east', 'gi');
  v := regexp_replace(v, '\mw\M', 'west', 'gi');
  v := regexp_replace(v, '\mst\M', 'street', 'gi');
  v := regexp_replace(v, '\mstr\M', 'street', 'gi');
  v := regexp_replace(v, '\mave\M', 'avenue', 'gi');
  v := regexp_replace(v, '\mav\M', 'avenue', 'gi');
  v := regexp_replace(v, '\mrd\M', 'road', 'gi');
  v := regexp_replace(v, '\mbr\M', 'boulevard', 'gi');
  v := regexp_replace(v, '\mblvd\M', 'boulevard', 'gi');
  v := regexp_replace(v, '\mdr\M', 'drive', 'gi');
  v := regexp_replace(v, '\mln\M', 'lane', 'gi');
  return trim(both ' ' from regexp_replace(v, '\s+', ' ', 'g'));
end;
$body$;

create or replace function public.meg_normalize_property_dedup_key(
  p_name text,
  p_address text,
  p_city text,
  p_state text
)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $body$
  with norm as (
    select
      public.meg_expand_street_tokens(public.meg_normalize_text_core(p_address)) as addr,
      public.meg_normalize_text_core(p_city) as city,
      public.meg_normalize_us_state(p_state) as state,
      public.meg_expand_street_tokens(public.meg_normalize_text_core(p_name)) as pname
  ),
  core as (
    select case
      when addr <> '' and city <> '' and length(state) = 2 then addr || '|' || city || '|' || state
      when pname <> '' and city <> '' and length(state) = 2 then pname || '|' || city || '|' || state
      when pname <> '' then pname
      else null
    end as v
    from norm
  )
  select case when v is null then null else 'prop:' || md5(v) end
  from core;
$body$;

commit;
