-- sql/2026-09-15_trial_budget.sql
-- Phase A only (additive): the signed-out trial lane (DeepSeek direct), founder rulings 2026-09-15 verbatim picker
-- answers: trial lane "DeepSeek direct (Recommended)", ceiling "$10 a month (Recommended)", build "Build it now, off
-- until key (Recommended)". This is a ruling-of-record EXCEPTION to the CLAUDE.md product rule that nothing runs on
-- the founders' own credits for a free user: the trial button stays hidden (worker/api.js TRIAL_ENABLED, worker rule
-- checked live) until Dylan sets DEEPSEEK_API_KEY and flips the var on. This migration only adds the budget ledger;
-- nothing existing changes shape, so there is no phase B and no coordinated deploy window.
-- One row per calendar month (UTC), spent_micro is the Worker's running reservation against ceiling_micro
-- (micro-dollars, 1e-6 USD; $10 = 10000000). Same shape and same atomic-UPDATE pattern as twingrid_capacity
-- (sql/2026-09-02_capacity.sql): a reservation is a service-role-only UPDATE ... WHERE spent+reserve<=ceiling,
-- so two concurrent reserves at the edge cannot both pass (Postgres row locking serializes the two UPDATEs).

create table if not exists public.twingrid_trial_budget (
  month         text primary key,
  spent_micro   bigint not null default 0 check (spent_micro >= 0),
  ceiling_micro bigint not null check (ceiling_micro >= 0),
  updated_at    timestamptz not null default now()
);
alter table public.twingrid_trial_budget enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_trial_budget from anon, authenticated, service_role, public;
revoke select on public.twingrid_trial_budget from anon, authenticated, public;
grant select, insert, update on public.twingrid_trial_budget to service_role;

-- Reserve p_reserve_micro against the month's ceiling. Inserts the month row on first use (ceiling stamped from
-- the Worker's TRIAL_CEILING_MICRO at call time), then the same atomic UPDATE...WHERE twingrid_capacity_spend
-- uses: true and counted, or false and nothing touched when the reservation would pass the ceiling.
create or replace function public.twingrid_trial_charge(p_month text, p_ceiling_micro bigint, p_reserve_micro bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_ok boolean;
begin
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'bad month' using errcode = '22023';
  end if;
  if p_ceiling_micro is null or p_ceiling_micro < 0 then
    raise exception 'ceiling out of range' using errcode = '22023';
  end if;
  -- Sanity cap on a SINGLE reservation, not the ceiling: one trial reply worst-case (60,000-char persona,
  -- 250 output tokens, peak price) is a few thousand micro; $1 is generous headroom against a typo'd caller.
  if p_reserve_micro is null or p_reserve_micro < 0 or p_reserve_micro > 1000000 then
    raise exception 'reserve out of range' using errcode = '22023';
  end if;
  insert into public.twingrid_trial_budget as b (month, spent_micro, ceiling_micro, updated_at)
  values (p_month, 0, p_ceiling_micro, now())
  on conflict (month) do nothing;
  update public.twingrid_trial_budget
     set spent_micro = spent_micro + p_reserve_micro,
         updated_at  = now()
   where month = p_month
     and spent_micro + p_reserve_micro <= ceiling_micro
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke execute on function public.twingrid_trial_charge(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.twingrid_trial_charge(text, bigint, bigint) to service_role;

-- Correct a reservation to actual usage (positive or negative delta). Never lets spent_micro go below zero.
-- A month with no row yet is a no-op (nothing was ever reserved for it, so there is nothing to settle).
create or replace function public.twingrid_trial_settle(p_month text, p_delta_micro bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'bad month' using errcode = '22023';
  end if;
  if p_delta_micro is null then
    raise exception 'delta required' using errcode = '22023';
  end if;
  update public.twingrid_trial_budget
     set spent_micro = greatest(0, spent_micro + p_delta_micro),
         updated_at  = now()
   where month = p_month;
end;
$$;
revoke execute on function public.twingrid_trial_settle(text, bigint) from public, anon, authenticated;
grant execute on function public.twingrid_trial_settle(text, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 1. anon over HTTP with the publishable key: GET twingrid_trial_budget?select=* -> 200 with an empty array (RLS,
--    no select grant to anon means PostgREST returns zero rows, never an error, since select itself is revoked
--    from anon and the table has RLS enabled with no anon policy); rpc twingrid_trial_charge -> 42501;
--    rpc twingrid_trial_settle -> 42501
-- 2. authenticated (a real sub, no service key): rpc twingrid_trial_charge -> 42501; rpc twingrid_trial_settle -> 42501;
--    insert/update/delete on twingrid_trial_budget -> 42501
-- 3. rolled back, service role: twingrid_trial_charge('2099-01', 1000, 600) -> true, row (2099-01, 600, 1000);
--    twingrid_trial_charge('2099-01', 1000, 500) -> false (600+500=1100>1000), row UNCHANGED at 600 (the ceiling
--    would be passed, so nothing was written); twingrid_trial_settle('2099-01', -600) -> void, row back to 0
-- 4. rolled back, service role, the edge: twingrid_trial_charge('2099-02', 1000, 500) -> true (row now 500);
--    twingrid_trial_charge('2099-02', 1000, 500) -> true (row now 1000, exactly the ceiling);
--    twingrid_trial_charge('2099-02', 1000, 1) -> false (two reserves at the edge cannot both succeed, and a
--    third reservation of any size is refused once the ceiling is hit exactly)
-- 5. rolled back: twingrid_trial_settle('2099-03', -50) on a month with no row -> void, no row created (a
--    settle before any reserve is a no-op, never a negative balance)
