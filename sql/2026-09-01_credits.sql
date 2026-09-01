-- Personakind: Hosted Haiku credits
-- Migration 2026-09-01_credits.sql
--
-- NOT YET APPLIED. Deliver only. Run it once in the Supabase SQL editor
-- (project jpepcqazscmhakxvutpg) or via the Supabase MCP apply_migration.
--
-- Scope rules for this project:
--   * The Supabase project is SHARED with an unrelated print app. Every object
--     created here is twingrid_ prefixed. Nothing else is touched.
--   * Browsers never write these tables. All writes come from the Cloudflare
--     Worker using the service role key, which bypasses RLS. The two functions
--     below are the only write paths and only the service role may execute them.
--   * Idempotent where practical: create if not exists, drop-then-create for
--     policies, create or replace for functions.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.twingrid_credits (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  balance        int  not null default 0 check (balance >= 0),
  period_end     timestamptz,
  rc_customer_id text,
  updated_at     timestamptz not null default now()
);

comment on table public.twingrid_credits is
  'Personakind hosted-chat credit balance, one row per Supabase user. Written only by the Worker (service role).';

create table if not exists public.twingrid_credit_events (
  id         bigserial primary key,
  user_id    uuid not null,
  delta      int  not null,
  kind       text not null check (kind in ('purchase', 'renewal', 'use', 'refund', 'grant')),
  ref        text unique,
  created_at timestamptz not null default now()
);

comment on table public.twingrid_credit_events is
  'Personakind credit ledger. ref carries the RevenueCat event id (or refund:<uuid>) so a replayed webhook is a no-op.';

create index if not exists twingrid_credit_events_user_idx
  on public.twingrid_credit_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.twingrid_credits       enable row level security;
alter table public.twingrid_credit_events enable row level security;

-- Belt and braces: even the table owner goes through RLS.
alter table public.twingrid_credits       force row level security;
alter table public.twingrid_credit_events force row level security;

drop policy if exists twingrid_credits_select_own on public.twingrid_credits;
create policy twingrid_credits_select_own
  on public.twingrid_credits
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists twingrid_credit_events_select_own on public.twingrid_credit_events;
create policy twingrid_credit_events_select_own
  on public.twingrid_credit_events
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert, update or delete policy exists for anon or authenticated, on
-- purpose. With RLS enabled and no matching policy, those statements are
-- denied. The service role bypasses RLS and is the only writer.

-- ---------------------------------------------------------------------------
-- 3. Table privileges
-- ---------------------------------------------------------------------------
-- Supabase grants ALL on new public tables to anon and authenticated by
-- default (via default privileges). RLS alone would already deny the writes,
-- but we revoke at the TABLE level too so a future policy mistake cannot
-- reopen them. This must be table level: a column level REVOKE against a
-- table level GRANT is a silent no-op.

revoke all on table public.twingrid_credits       from anon, authenticated;
revoke all on table public.twingrid_credit_events from anon, authenticated;

grant select on table public.twingrid_credits       to authenticated;
grant select on table public.twingrid_credit_events to authenticated;

-- The bigserial sequence is only used by the service role.
revoke all on sequence public.twingrid_credit_events_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. twingrid_use_credit(p_user uuid) returns int
-- ---------------------------------------------------------------------------
-- Atomically spends one credit. Returns the new balance, or -1 if the user has
-- no spendable credit (no row, balance 0, or period_end in the past).
-- The single UPDATE ... WHERE balance > 0 is the concurrency guard: two
-- parallel calls cannot both succeed on a balance of 1.

create or replace function public.twingrid_use_credit(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
begin
  update public.twingrid_credits
     set balance    = balance - 1,
         updated_at = now()
   where user_id = p_user
     and balance > 0
     and (period_end is null or period_end > now())
  returning balance into v_balance;

  if v_balance is null then
    return -1;
  end if;

  insert into public.twingrid_credit_events (user_id, delta, kind, ref)
  values (p_user, -1, 'use', null);

  return v_balance;
end;
$$;

revoke execute on function public.twingrid_use_credit(uuid) from public, anon, authenticated;
-- service_role keeps EXECUTE (functions default to PUBLIC execute; we revoked
-- PUBLIC above, so grant it back to the one caller that should have it).
grant execute on function public.twingrid_use_credit(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. twingrid_grant_credits(p_user, p_delta, p_kind, p_ref, p_period_end) returns int
-- ---------------------------------------------------------------------------
-- Idempotent grant. If p_ref already exists in the ledger the call changes
-- nothing and returns the current balance. Otherwise it upserts the balance,
-- optionally moves period_end forward, and records the event.
-- p_delta may be negative for a correction; the check constraint on balance
-- rejects a result below zero, which is the intended failure mode.

create or replace function public.twingrid_grant_credits(
  p_user       uuid,
  p_delta      int,
  p_kind       text,
  p_ref        text,
  p_period_end timestamptz
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
begin
  if p_ref is not null and exists (
    select 1 from public.twingrid_credit_events where ref = p_ref
  ) then
    select balance into v_balance from public.twingrid_credits where user_id = p_user;
    return coalesce(v_balance, 0);
  end if;

  insert into public.twingrid_credits (user_id, balance, period_end, updated_at)
  values (p_user, greatest(p_delta, 0), p_period_end, now())
  on conflict (user_id) do update
     set balance    = public.twingrid_credits.balance + p_delta,
         period_end = coalesce(p_period_end, public.twingrid_credits.period_end),
         updated_at = now()
  returning balance into v_balance;

  insert into public.twingrid_credit_events (user_id, delta, kind, ref)
  values (p_user, p_delta, p_kind, p_ref);

  return v_balance;
end;
$$;

-- Note on the upsert above: a first-ever row with a negative p_delta is
-- clamped to 0 (there was nothing to take away). On an existing row the
-- balance moves by p_delta and the check constraint rejects a result < 0.

revoke execute on function public.twingrid_grant_credits(uuid, int, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.twingrid_grant_credits(uuid, int, text, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. PostgREST schema cache
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
