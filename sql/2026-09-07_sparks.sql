-- Personakind Sparks and the age gate (M5, 2026-09-07). PLAN.md section 3.3 and 5, M5.
--
-- A Spark is what a visitor leaves: an anonymous visit count per day, a reaction, a short note, or, only when the
-- visitor opted in at the end of a chat, the conversation itself (private to the owner). Blocks stop a visitor from
-- sparking or chatting with a persona. Publishing a persona requires the owner's 18-plus confirmation (Ruled C11).
--
-- Two phases. PHASE A (everything except the publish trigger) is applied before the push as migration
-- twingrid_sparks_phase_a: additive, today's page ignores it. PHASE B (the trigger) is applied AFTER the page with the
-- 18-plus checkbox is live, as twingrid_sparks_phase_b, because the trigger would refuse the live publish switch until then. Every relation: RLS on, the explicit
-- revoke, then exactly the grants it needs. Writes go through the Worker (/api/spark, service key) after it verifies the
-- caller, the target's public state and the block list; the operator deletes their own rows directly under RLS.

-- 1. Blocks: the operator's own list. Read by the Worker (service role) on every spark and every stranger chat.
create table if not exists public.twingrid_blocks (
  owner           uuid not null references auth.users(id) on delete cascade,
  blocked_account uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (owner, blocked_account),
  check (owner <> blocked_account)
);
alter table public.twingrid_blocks enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_blocks from anon, authenticated, service_role, public;
grant select on public.twingrid_blocks to anon, authenticated, service_role;
grant insert, delete on public.twingrid_blocks to authenticated;
drop policy if exists twingrid_blocks_select on public.twingrid_blocks;
create policy twingrid_blocks_select on public.twingrid_blocks for select using (public.twingrid_operates(owner));
drop policy if exists twingrid_blocks_insert on public.twingrid_blocks;
create policy twingrid_blocks_insert on public.twingrid_blocks for insert with check (public.twingrid_operates(owner));
drop policy if exists twingrid_blocks_delete on public.twingrid_blocks;
create policy twingrid_blocks_delete on public.twingrid_blocks for delete using (public.twingrid_operates(owner));

-- 2. Sparks. owner is the TARGET persona's owner (denormalised so the policies never join under RLS).
create table if not exists public.twingrid_sparks (
  id           bigint generated always as identity primary key,
  grid_id      uuid not null references public.twingrid_grids(id) on delete cascade,
  owner        uuid not null references auth.users(id) on delete cascade,
  from_account uuid references auth.users(id) on delete set null,
  from_grid    uuid references public.twingrid_grids(id) on delete set null,
  kind         text not null check (kind in ('visit','reaction','note','conversation')),
  reaction     text check (reaction is null or reaction in ('wave','spark','laugh','think','heart','clap')),
  note         text check (note is null or char_length(note) <= 280),
  transcript   jsonb check (transcript is null or (jsonb_typeof(transcript) = 'array' and jsonb_array_length(transcript) <= 40 and octet_length(transcript::text) <= 24000)),
  is_public    boolean not null default true,
  day          date,
  count        int not null default 1 check (count >= 1),
  created_at   timestamptz not null default now(),
  check (
    (kind = 'visit'        and day is not null and from_account is null and reaction is null and note is null and transcript is null and is_public = false) or
    (kind = 'reaction'     and reaction is not null and note is null and transcript is null) or
    (kind = 'note'         and note is not null and reaction is null and transcript is null) or
    (kind = 'conversation' and transcript is not null and is_public = false and reaction is null and note is null))
);
alter table public.twingrid_sparks enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_sparks from anon, authenticated, service_role, public;
grant select on public.twingrid_sparks to anon, authenticated, service_role;
grant insert, update, delete on public.twingrid_sparks to service_role;   -- delete: the 90-day sweep of opted-in conversations (applied as twingrid_sparks_phase_a2)
grant delete on public.twingrid_sparks to authenticated;
drop policy if exists twingrid_sparks_select on public.twingrid_sparks;
create policy twingrid_sparks_select on public.twingrid_sparks for select using (public.twingrid_operates(owner));
drop policy if exists twingrid_sparks_delete on public.twingrid_sparks;
create policy twingrid_sparks_delete on public.twingrid_sparks for delete using (public.twingrid_operates(owner) or (from_account is not null and from_account = auth.uid()));
create index if not exists twingrid_sparks_grid_idx on public.twingrid_sparks (grid_id, created_at desc);
create unique index if not exists twingrid_sparks_visit_day on public.twingrid_sparks (grid_id, day) where kind = 'visit';

-- 3. Anonymous visit counts: one row per persona per UTC day, incremented by the Worker. No identity is stored.
create or replace function public.twingrid_spark_visit(p_grid uuid) returns integer
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_owner uuid; v_count int;
begin
  select owner into v_owner from public.twingrid_grids_public where id = p_grid;
  if v_owner is null then return -1; end if;
  insert into public.twingrid_sparks (grid_id, owner, kind, day, is_public, count)
  values (p_grid, v_owner, 'visit', (now() at time zone 'utc')::date, false, 1)
  on conflict (grid_id, day) where kind = 'visit'
  do update set count = public.twingrid_sparks.count + 1
  returning count into v_count;
  return v_count;
end
$$;
revoke execute on function public.twingrid_spark_visit(uuid) from public, anon, authenticated;
grant execute on function public.twingrid_spark_visit(uuid) to service_role;

-- 4. The public face of Sparks: reactions and notes the visitor left in public, on personas that are public. Never a conversation.
create or replace view public.twingrid_sparks_public
with (security_invoker = false, security_barrier = true) as
  select s.id, s.grid_id, s.from_account, s.kind, s.reaction, s.note, s.created_at
  from public.twingrid_sparks s
  join public.twingrid_grids_public g on g.id = s.grid_id
  where s.is_public and s.kind in ('reaction','note')
    and (s.from_account is null or not exists (select 1 from public.twingrid_accounts a where a.id = s.from_account and a.is_suspended));
alter view public.twingrid_sparks_public owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_sparks_public from anon, authenticated, service_role, public;
grant select on public.twingrid_sparks_public to anon, authenticated;

-- 5. Visit totals for the persona page and the owner, without identity: one number per persona.
create or replace function public.twingrid_visit_count(p_grid uuid) returns integer
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(s.count), 0)::int from public.twingrid_sparks s
  join public.twingrid_grids_public g on g.id = s.grid_id
  where s.grid_id = p_grid and s.kind = 'visit'
$$;
grant execute on function public.twingrid_visit_count(uuid) to anon, authenticated, service_role;

-- 6. The age gate (Ruled 2026-09-07, C11): 18 plus to publish, confirmed once per account; private building is not gated.
--    The column is phase A. The trigger below is PHASE B.
alter table public.twingrid_accounts add column if not exists adult_confirmed_at timestamptz;
-- twingrid_accounts is COLUMN-granted (2026-08-29); a new column is invisible to the API roles until it is granted (applied as twingrid_accounts_new_column_grants)
grant select (adult_confirmed_at), insert (adult_confirmed_at), update (adult_confirmed_at) on public.twingrid_accounts to authenticated;

-- ===================== PHASE B (after the page with the checkbox is live) =====================
create or replace function public.twingrid_publish_gate() returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.is_public and (tg_op = 'INSERT' or not old.is_public) then
    if not exists (select 1 from public.twingrid_accounts a where a.id = new.owner and a.adult_confirmed_at is not null) then
      raise exception 'adult_confirmation_required' using errcode = 'P0001', hint = 'Confirm you are 18 or older on the publish switch first.';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists twingrid_publish_gate on public.twingrid_grids;
create trigger twingrid_publish_gate before insert or update of is_public on public.twingrid_grids
  for each row execute function public.twingrid_publish_gate();

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 29. anon: sparks 0, blocks 0, sparks_public 0 (nothing yet), visit_count of any grid 0; insert into sparks -> 42501 (no grant)
-- 30. stranger (authenticated, foreign sub): sparks 0, blocks 0; insert into blocks for someone else's owner -> RLS 42501;
--     delete from sparks -> 0 rows (policy); update sparks -> 42501 (no grant)
-- 31. twingrid_spark_visit as anon -> 42501 (execute revoked); as service_role, twice on a public grid -> 1 then 2, then
--     twingrid_visit_count -> 2 (rolled back)
-- 32. publish gate: in a DO block, set an account's adult_confirmed_at to null, flip one of its private grids to public
--     -> ERROR adult_confirmation_required; set adult_confirmed_at = now() -> the same update succeeds; roll back
-- 33. HTTP with the publishable key: GET twingrid_sparks 200 [], GET twingrid_blocks 200 [], GET twingrid_sparks_public 200 [],
--     POST twingrid_sparks 401, POST rpc/twingrid_spark_visit 401, PATCH twingrid_sparks_public 500 (55000, not updatable)
