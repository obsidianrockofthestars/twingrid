-- sql/2026-09-08_house_guests.sql
-- Whole house guests (Dylan, 2026-09-08, reading B, the round after the access layer): the owner names accounts that may read
-- a persona's whole house, every facet including Private, on the public page. Guests read; they never write. The owner
-- (or an operator) adds and removes; a guest may remove themself. Phase A only: one table with RLS, the projection, the
-- guest read function. The Lobby and Kindred projections are untouched. Applied 2026-09-08 as twingrid_house_guests.

create table if not exists public.twingrid_house_guests (
  id         bigint generated always as identity primary key,
  grid_id    uuid not null references public.twingrid_grids(id) on delete cascade,
  owner      uuid not null references auth.users(id) on delete cascade,
  guest      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (grid_id, guest),
  check (owner <> guest)
);
alter table public.twingrid_house_guests enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_house_guests from anon, authenticated, service_role, public;
grant select on public.twingrid_house_guests to authenticated, service_role;
revoke select on public.twingrid_house_guests from anon;   -- the default privilege leaves SELECT with anon; RLS gives it zero rows, the revoke says so out loud (applied as twingrid_house_guests_anon_revoke)
grant insert, delete on public.twingrid_house_guests to authenticated;
grant insert, delete on public.twingrid_house_guests to service_role;
drop policy if exists twingrid_house_guests_select on public.twingrid_house_guests;
create policy twingrid_house_guests_select on public.twingrid_house_guests for select
  using (public.twingrid_operates(owner) or guest = auth.uid());
drop policy if exists twingrid_house_guests_insert on public.twingrid_house_guests;
create policy twingrid_house_guests_insert on public.twingrid_house_guests for insert
  with check (public.twingrid_operates(owner) and exists (select 1 from public.twingrid_grids g where g.id = grid_id and g.owner = owner));
drop policy if exists twingrid_house_guests_delete on public.twingrid_house_guests;
create policy twingrid_house_guests_delete on public.twingrid_house_guests for delete
  using (public.twingrid_operates(owner) or guest = auth.uid());
create index if not exists twingrid_house_guests_guest_idx on public.twingrid_house_guests (guest);

-- the whole house: every facet, the full Home, marked so the page knows which door it came through
create or replace function public.twingrid_house_proj(d jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'facets',      case when jsonb_typeof(d->'facets') = 'array' then d->'facets' else '[]'::jsonb end,
    'name',        d->'name',
    'tagline',     d->'tagline',
    'template',    d->'template',
    'theme',       d->'theme',
    'house',       d->'house',
    'kindred',     true,
    'whole_house', true))
$$;

-- what a signed-in guest reads: the whole house of a public persona they are listed on, else nothing (the page then falls back
-- to the Kindred read and the Lobby). Never for anon. The owner reads their own grid through the table, not through here.
create or replace function public.twingrid_house_view(p_grid uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare d jsonb;
begin
  if (select auth.uid()) is null then return null; end if;
  if not exists (select 1 from public.twingrid_house_guests hg where hg.grid_id = p_grid and hg.guest = (select auth.uid())) then return null; end if;
  select g.data into d from public.twingrid_grids g
  where g.id = p_grid and g.is_public and g.is_suspended = false and not public.twingrid_owner_suspended(g.owner);
  if d is null then return null; end if;
  return public.twingrid_house_proj(d);
end
$$;
revoke execute on function public.twingrid_house_view(uuid) from public, anon;
grant execute on function public.twingrid_house_view(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 44. anon: select from twingrid_house_guests -> 42501 after the revoke (first run: no error, zero rows under RLS, the default SELECT privilege);
--     twingrid_house_view(a public grid) -> 42501 (execute revoked)
-- 45. stranger (authenticated, foreign sub): select -> 0 rows; insert a guest row on a grid they do not own -> 42501 (RLS);
--     twingrid_house_view(a public grid) -> null
-- 46. service role in a DO block, rolled back: insert guest = stranger on a public grid; as that stranger, house_view returns
--     every facet (house scope included) with whole_house true and kindred true; as another authenticated sub -> null;
--     owner = guest -> check violation 23514; the stranger deletes their own row -> 1 row gone
-- 47. HTTP with the publishable key: GET twingrid_house_guests 401, POST rpc/twingrid_house_view 401
