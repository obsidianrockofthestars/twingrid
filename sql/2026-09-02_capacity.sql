-- Personakind capacity gate, 2026-09-02 (Dylan's ruling, CDD council).
-- One row per prepaid provider. funded_micro is what Dylan has paid in (micro-dollars, 1e-6 USD),
-- spent_micro is the Worker's running estimate. The Worker refuses a paid call when the estimate
-- would pass funded minus the reserve, so the site pauses BEFORE the provider fails.
-- Anthropic: 1 micro per input token, 5 per output token (Haiku 4.5). Google image: 67000 per image.
-- Gemini TTS: about 33 per character. Both providers are prepaid on Dylan's accounts (read 2026-09-02).

create table if not exists public.twingrid_capacity (
  provider     text primary key check (provider in ('anthropic', 'google')),
  funded_micro bigint not null default 0 check (funded_micro >= 0),
  spent_micro  bigint not null default 0 check (spent_micro >= 0),
  reserve_pct  int    not null default 10 check (reserve_pct between 0 and 90),
  updated_at   timestamptz not null default now()
);
alter table public.twingrid_capacity enable row level security;
revoke all on table public.twingrid_capacity from public, anon, authenticated;
grant select, insert, update on table public.twingrid_capacity to service_role;

insert into public.twingrid_capacity (provider, funded_micro) values ('anthropic', 0), ('google', 0)
on conflict (provider) do nothing;

-- Reserve capacity for one call. True = allowed and counted. False = at capacity, nothing counted.
create or replace function public.twingrid_capacity_spend(p_provider text, p_micro bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean;
begin
  if p_micro is null or p_micro < 0 or p_micro > 10000000 then
    raise exception 'micro out of range' using errcode = '22023';
  end if;
  update public.twingrid_capacity
     set spent_micro = spent_micro + p_micro,
         updated_at  = now()
   where provider = p_provider
     and spent_micro + p_micro <= funded_micro * (100 - reserve_pct) / 100
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke execute on function public.twingrid_capacity_spend(text, bigint) from public, anon, authenticated;
grant execute on function public.twingrid_capacity_spend(text, bigint) to service_role;

-- Dylan tops up: adds what he paid the provider, in micro-dollars ($25 = 25000000).
create or replace function public.twingrid_capacity_fund(p_provider text, p_micro bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_funded bigint;
begin
  update public.twingrid_capacity
     set funded_micro = funded_micro + p_micro,
         updated_at   = now()
   where provider = p_provider
  returning funded_micro into v_funded;
  return v_funded;
end;
$$;
revoke execute on function public.twingrid_capacity_fund(text, bigint) from public, anon, authenticated;
grant execute on function public.twingrid_capacity_fund(text, bigint) to service_role;

-- The public meter: percent used per provider, nothing else. Readable by anyone.
create or replace function public.twingrid_capacity_public()
returns table (provider text, pct_used int)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select provider,
         case when funded_micro = 0 then 100
              else least(100, (spent_micro * 100 / greatest(1, funded_micro * (100 - reserve_pct) / 100)))::int end
    from public.twingrid_capacity
   order by provider;
$$;
revoke execute on function public.twingrid_capacity_public() from public;
grant execute on function public.twingrid_capacity_public() to anon, authenticated, service_role;
