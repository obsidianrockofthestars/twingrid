-- 2026-09-04 (OWASP F2): give back a capacity reservation the provider never honoured.
-- Mirrors twingrid_capacity_spend; service role only, like every ledger function. Applied to
-- prod through the Supabase connector the same day; kept here as the record.
create or replace function public.twingrid_capacity_unspend(p_provider text, p_micro bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_micro is null or p_micro < 0 or p_micro > 10000000 then
    raise exception 'micro out of range' using errcode = '22023';
  end if;
  update public.twingrid_capacity
     set spent_micro = greatest(0, spent_micro - p_micro),
         updated_at  = now()
   where provider = p_provider;
end;
$$;
revoke all on function public.twingrid_capacity_unspend(text, bigint) from public, anon, authenticated;
