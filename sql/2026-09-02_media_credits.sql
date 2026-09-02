-- 2026-09-02: paid media on the credit ledger (Dylan's rulings: image create 15 credits, daily caps 10 images
-- and 200 voiced replies per user, costs carried by the user). A multi-credit spend with a named kind, and a
-- per-day counter the Worker ticks before it calls Google. Service role only, like the rest of the ledger.
-- Applied to jpepcqazscmhakxvutpg on 2026-09-02 as migration twingrid_media_credits_and_daily_caps.

alter table public.twingrid_credit_events
  drop constraint twingrid_credit_events_kind_check,
  add constraint twingrid_credit_events_kind_check
    check (kind in ('purchase', 'renewal', 'use', 'refund', 'grant', 'expire', 'image', 'voice'));

create or replace function public.twingrid_use_credits(p_user uuid, p_cost int, p_kind text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
begin
  if p_cost is null or p_cost < 1 or p_cost > 500 then
    raise exception 'cost out of range' using errcode = '22023';
  end if;
  if p_kind not in ('image', 'voice', 'use') then
    raise exception 'unknown spend kind' using errcode = '22023';
  end if;
  update public.twingrid_credits
     set balance    = balance - p_cost,
         updated_at = now()
   where user_id = p_user
     and balance >= p_cost
     and (period_end is null or period_end > now())
  returning balance into v_balance;
  if v_balance is null then
    return -1;
  end if;
  insert into public.twingrid_credit_events (user_id, delta, kind, ref)
  values (p_user, -p_cost, p_kind, null);
  return v_balance;
end;
$$;
revoke execute on function public.twingrid_use_credits(uuid, int, text) from public, anon, authenticated;
grant execute on function public.twingrid_use_credits(uuid, int, text) to service_role;

create table if not exists public.twingrid_media_daily (
  user_id uuid not null,
  day     date not null,
  images  int  not null default 0 check (images >= 0),
  voices  int  not null default 0 check (voices >= 0),
  primary key (user_id, day)
);
alter table public.twingrid_media_daily enable row level security;
revoke all on public.twingrid_media_daily from public, anon, authenticated;

create or replace function public.twingrid_media_tick(p_user uuid, p_kind text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean := false;
  v_day date := (now() at time zone 'UTC')::date;
begin
  insert into public.twingrid_media_daily (user_id, day) values (p_user, v_day)
  on conflict (user_id, day) do nothing;
  if p_kind = 'image' then
    update public.twingrid_media_daily set images = images + 1
     where user_id = p_user and day = v_day and images < p_limit
     returning true into v_ok;
  elsif p_kind = 'voice' then
    update public.twingrid_media_daily set voices = voices + 1
     where user_id = p_user and day = v_day and voices < p_limit
     returning true into v_ok;
  else
    raise exception 'unknown media kind' using errcode = '22023';
  end if;
  return coalesce(v_ok, false);
end;
$$;
revoke execute on function public.twingrid_media_tick(uuid, text, int) from public, anon, authenticated;
grant execute on function public.twingrid_media_tick(uuid, text, int) to service_role;

-- Added the same afternoon (migration twingrid_media_untick): a failed Google call gives the daily slot back.
create or replace function public.twingrid_media_untick(p_user uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
begin
  if p_kind = 'image' then
    update public.twingrid_media_daily set images = greatest(0, images - 1) where user_id = p_user and day = v_day;
  elsif p_kind = 'voice' then
    update public.twingrid_media_daily set voices = greatest(0, voices - 1) where user_id = p_user and day = v_day;
  else
    raise exception 'unknown media kind' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.twingrid_media_untick(uuid, text) from public, anon, authenticated;
grant execute on function public.twingrid_media_untick(uuid, text) to service_role;
