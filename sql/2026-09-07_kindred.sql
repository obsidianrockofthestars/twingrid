-- Personakind Kindred, Circle and persona-to-persona (M6, 2026-09-07). PLAN.md section 3.4 and 5, M6.
--
-- Circle is a one-way follow of a persona by a member. Kindred is mutual: one side requests from one of its own personas,
-- the other side accepts, declines or blocks, and only an accepted pair can see each other's Kindred facets or talk.
-- The existing twingrid_follows table follows ACCOUNTS (follower, target both auth.users) and stays unused; Circle follows
-- a persona, so it gets its own small table.
--
-- Every Kindred write goes through the Worker (/api/kindred, service key) after it verifies the caller operates the
-- requesting or receiving persona; the table gives operators SELECT only. Circle writes are the member's own rows under RLS.
-- One phase (everything new), applied before the push as migration twingrid_kindred.

-- 1. Circle
create table if not exists public.twingrid_circle (
  follower   uuid not null references auth.users(id) on delete cascade,
  grid_id    uuid not null references public.twingrid_grids(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, grid_id)
);
alter table public.twingrid_circle enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_circle from anon, authenticated, service_role, public;
grant select on public.twingrid_circle to anon, authenticated, service_role;
grant insert, delete on public.twingrid_circle to authenticated;
drop policy if exists twingrid_circle_select on public.twingrid_circle;
create policy twingrid_circle_select on public.twingrid_circle for select using (follower = (select auth.uid()));
drop policy if exists twingrid_circle_insert on public.twingrid_circle;
create policy twingrid_circle_insert on public.twingrid_circle for insert with check (
  follower = (select auth.uid()) and exists (select 1 from public.twingrid_grids_public g where g.id = grid_id and g.owner <> (select auth.uid())));
drop policy if exists twingrid_circle_delete on public.twingrid_circle;
create policy twingrid_circle_delete on public.twingrid_circle for delete using (follower = (select auth.uid()));
create index if not exists twingrid_circle_grid_idx on public.twingrid_circle (grid_id);

-- The count anyone may see, for public personas only; never who.
create or replace function public.twingrid_circle_count(p_grid uuid) returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.twingrid_circle c join public.twingrid_grids_public g on g.id = c.grid_id where c.grid_id = p_grid
$$;
grant execute on function public.twingrid_circle_count(uuid) to anon, authenticated, service_role;

-- 2. Kindred. One row per unordered pair (grid_a < grid_b). Owners denormalised so the select policy never joins under RLS.
create table if not exists public.twingrid_kindred (
  id           bigint generated always as identity primary key,
  grid_a       uuid not null references public.twingrid_grids(id) on delete cascade,
  grid_b       uuid not null references public.twingrid_grids(id) on delete cascade,
  owner_a      uuid not null references auth.users(id) on delete cascade,
  owner_b      uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null,
  status       text not null default 'requested' check (status in ('requested','accepted','declined','blocked')),
  learning     boolean not null default false,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  check (grid_a < grid_b),
  check (owner_a <> owner_b),
  check (requested_by = grid_a or requested_by = grid_b),
  unique (grid_a, grid_b)
);
alter table public.twingrid_kindred enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_kindred from anon, authenticated, service_role, public;
grant select on public.twingrid_kindred to anon, authenticated, service_role;
grant insert, update, delete on public.twingrid_kindred to service_role;
drop policy if exists twingrid_kindred_select on public.twingrid_kindred;
create policy twingrid_kindred_select on public.twingrid_kindred for select using (public.twingrid_operates(owner_a) or public.twingrid_operates(owner_b));
create index if not exists twingrid_kindred_b_idx on public.twingrid_kindred (grid_b);

-- 3. Is this pair Kindred? For the Worker and the projections.
create or replace function public.twingrid_is_kindred(a uuid, b uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.twingrid_kindred k
    where k.status = 'accepted' and k.grid_a = least(a, b) and k.grid_b = greatest(a, b))
$$;
grant execute on function public.twingrid_is_kindred(uuid, uuid) to anon, authenticated, service_role;

-- 4. The Kindred projection of a grid's data: Public plus Kindred facets, and the Home with doors to both kept.
create or replace function public.twingrid_kindred_proj(d jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  with f as (
    select x from jsonb_array_elements(case when jsonb_typeof(d->'facets') = 'array' then d->'facets' else '[]'::jsonb end) x
    where public.twingrid_facet_scope(x) in ('lobby','visiting'))
  select jsonb_strip_nulls(jsonb_build_object(
    'facets',   coalesce((select jsonb_agg(x) from f), '[]'::jsonb),
    'name',     d->'name',
    'tagline',  d->'tagline',
    'template', d->'template',
    'theme',    d->'theme',
    'house',    public.twingrid_house_public(d->'house', coalesce((select array_agg(x->>'name') from f), '{}'::text[])),
    'kindred',  true))
$$;

-- 5. What a persona shows to a given viewer persona: the Kindred projection for an accepted pair, else the Lobby projection.
--    A signed-in caller must operate the viewer persona; the service role (auth.uid() null) is trusted, the Worker checked already.
create or replace function public.twingrid_kindred_view(p_grid uuid, p_viewer_grid uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare d jsonb; ok boolean;
begin
  select g.data into d from public.twingrid_grids g
  where g.id = p_grid and g.is_public and g.is_suspended = false and not public.twingrid_owner_suspended(g.owner);
  if d is null then return null; end if;
  ok := (select auth.uid()) is null
        or exists (select 1 from public.twingrid_grids v where v.id = p_viewer_grid and public.twingrid_operates(v.owner));
  if ok and public.twingrid_is_kindred(p_grid, p_viewer_grid) then return public.twingrid_kindred_proj(d); end if;
  return public.twingrid_lobby(d);
end
$$;
grant execute on function public.twingrid_kindred_view(uuid, uuid) to anon, authenticated, service_role;

-- 6. The pairs a persona has, for the persona page (an accepted Kindred list is public knowledge, the pending ones are not).
create or replace function public.twingrid_kindred_of(p_grid uuid) returns table (grid_id uuid, name text)
language sql stable security definer
set search_path = ''
as $$
  select g.id, g.name from public.twingrid_kindred k
  join public.twingrid_grids_public g on g.id = case when k.grid_a = p_grid then k.grid_b else k.grid_a end
  where k.status = 'accepted' and (k.grid_a = p_grid or k.grid_b = p_grid)
    and exists (select 1 from public.twingrid_grids_public me where me.id = p_grid)
  order by k.decided_at desc nulls last
$$;
grant execute on function public.twingrid_kindred_of(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 34. anon: circle 0, kindred 0, circle_count of a public grid 0, is_kindred(x, y) false, kindred_view(public grid, random) = the Lobby
--     projection (no facet with scope visiting, no "kindred" key); insert into kindred -> 42501 (no grant)
-- 35. stranger: insert into circle for a public grid they do not own -> 1 row (rolled back); for their own grid -> RLS 42501;
--     select kindred -> 0 rows; update kindred -> 42501
-- 36. service role in a DO block, rolled back: insert an accepted pair between two public grids of different owners,
--     is_kindred true both orders, kindred_view(a, b) carries the visiting facets and "kindred": true, kindred_view(a, other) does not,
--     kindred_of(a) lists b
-- 37. HTTP with the publishable key: GET twingrid_circle 200 [], GET twingrid_kindred 200 [], POST twingrid_kindred 401,
--     POST rpc/twingrid_kindred_view with a public grid and a random uuid 200 (the Lobby projection), POST rpc/twingrid_circle_count 200 0
