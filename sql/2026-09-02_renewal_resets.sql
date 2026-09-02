-- 2026-09-02: a purchase or renewal SETS the balance to the pack instead of
-- adding to it (Dylan's ruling 2026-09-02, option ii). The card copy promises
-- "unused messages stay until the month ends"; adding at renewal let them roll
-- over, and adding at a re-purchase after expiry revived dead credits. Any
-- leftover is written to the ledger as an 'expire' row so the ledger still sums
-- to the balance. Corrections (any other p_kind) keep adding. Idempotency on
-- p_ref unchanged. Grants and execute rights unchanged (service role only).

alter table public.twingrid_credit_events
  drop constraint twingrid_credit_events_kind_check,
  add constraint twingrid_credit_events_kind_check
    check (kind in ('purchase', 'renewal', 'use', 'refund', 'grant', 'expire'));

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
  v_old     int;
begin
  if p_ref is not null and exists (
    select 1 from public.twingrid_credit_events where ref = p_ref
  ) then
    select balance into v_balance from public.twingrid_credits where user_id = p_user;
    return coalesce(v_balance, 0);
  end if;

  if p_kind in ('purchase', 'renewal') then
    select balance into v_old from public.twingrid_credits where user_id = p_user for update;
    if coalesce(v_old, 0) > 0 then
      insert into public.twingrid_credit_events (user_id, delta, kind, ref)
      values (p_user, -v_old, 'expire', case when p_ref is null then null else p_ref || ':expire' end);
    end if;
    insert into public.twingrid_credits (user_id, balance, period_end, updated_at)
    values (p_user, greatest(p_delta, 0), p_period_end, now())
    on conflict (user_id) do update
       set balance    = greatest(p_delta, 0),
           period_end = coalesce(p_period_end, public.twingrid_credits.period_end),
           updated_at = now()
    returning balance into v_balance;
  else
    insert into public.twingrid_credits (user_id, balance, period_end, updated_at)
    values (p_user, greatest(p_delta, 0), p_period_end, now())
    on conflict (user_id) do update
       set balance    = public.twingrid_credits.balance + p_delta,
           period_end = coalesce(p_period_end, public.twingrid_credits.period_end),
           updated_at = now()
    returning balance into v_balance;
  end if;

  insert into public.twingrid_credit_events (user_id, delta, kind, ref)
  values (p_user, p_delta, p_kind, p_ref);

  return v_balance;
end;
$$;
