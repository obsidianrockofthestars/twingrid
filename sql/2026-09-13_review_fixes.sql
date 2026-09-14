-- sql/2026-09-13_review_fixes.sql
-- The full adversarial review of 2026-09-13 (five finders, refuters on every claim) found four holes in code older than that day and two
-- gaps the Room needed. Every change here is a lockdown or an additive projection; the live page reads nothing that goes away
-- (the page never lists the bucket, calls twingrid_kindred_view only when signed in, and never calls the helper functions as anon).
-- Applied 2026-09-13 as twingrid_review_fixes. Probes in the footer; the outputs are in the PR.

-- 1. The media bucket. The read policy granted SELECT on every object to anon, so the Storage list API enumerated every account
--    folder, every grid folder under it and every file, including the portraits of personas the database refuses to admit exist.
--    Public rendering never used it: a public bucket serves /object/public/... without evaluating RLS. Read stays for the caller's
--    own folder, matching the three write policies beside it.
drop policy if exists "twingrid_media_read" on storage.objects;
drop policy if exists "twingrid_media_read_own" on storage.objects;
create policy "twingrid_media_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'twingrid-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. twingrid_kindred_view trusted "auth.uid() is null" as the service role, and an anonymous PostgREST caller also has no uid, so a
--    stranger who knew an accepted pair (twingrid_kindred_of is public) read the Kindred facets. The trusted path is the JWT role,
--    read through auth.role(); inside a SECURITY DEFINER body current_user is the definer and would say nothing (rule 8). Anon
--    loses execute: the page calls this only while signed in, the Worker calls it with the service key.
create or replace function public.twingrid_kindred_view(p_grid uuid, p_viewer_grid uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare d jsonb; ok boolean;
begin
  select g.data into d from public.twingrid_grids g
  where g.id = p_grid and g.is_public and g.is_suspended = false and not public.twingrid_owner_suspended(g.owner);
  if d is null then return null; end if;
  ok := coalesce(auth.role(), '') = 'service_role'
        or ((select auth.uid()) is not null
            and exists (select 1 from public.twingrid_grids v where v.id = p_viewer_grid and public.twingrid_operates(v.owner)));
  if ok and public.twingrid_is_kindred(p_grid, p_viewer_grid) then return public.twingrid_kindred_proj(d); end if;
  return public.twingrid_lobby(d);
end
$$;
revoke execute on function public.twingrid_kindred_view(uuid, uuid) from public, anon;
grant execute on function public.twingrid_kindred_view(uuid, uuid) to authenticated, service_role;

-- 3. The media folder guard fired on UPDATE only, so a persona could be INSERTED pointing at another account's upload. It now fires
--    on insert too, with OLD absent on that path.
create or replace function public.twingrid_media_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_url is not null and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url) then
    if coalesce(auth.role(), '') <> 'service_role'
       and (auth.uid() is null
            or position('/twingrid-media/' || auth.uid()::text || '/' in new.image_url) = 0) then
      raise exception 'image must live in your own media folder' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists twingrid_media_guard on public.twingrid_grids;
create trigger twingrid_media_guard
  before insert or update on public.twingrid_grids
  for each row execute function public.twingrid_media_guard();

-- 4. Postgres hands EXECUTE on every new function to PUBLIC, and eight helpers were granted without the revoke rule 1 requires, so
--    anon could call them over REST. Five are closed to anon and PUBLIC. THREE STAY GRANTED TO ANON ON PURPOSE: twingrid_lobby,
--    twingrid_facet_scope and twingrid_house_public are called INSIDE the twingrid_grids_public view, and a view checks EXECUTE on
--    the functions it calls as the CALLER, not as the view owner (only table access takes the owner's privileges). Revoking anon on
--    those three broke every stranger read of the view for about four minutes on 2026-09-13 20:53 to 20:58 UTC (PostgREST answered
--    42501 permission denied for function twingrid_lobby on any select carrying data) and was reverted with a standalone grant.
--    Post-mortem in the PR. Rule 5 in CLAUDE.md now reads: never revoke EXECUTE from anon on a function a SELECT policy OR A VIEW
--    calls. authenticated keeps the two validators (a CHECK constraint runs them as the inserting role). No RLS policy calls any of
--    these (pg_policy read 2026-09-13 before this was written). twingrid_place_counts is read by the owner only.
revoke execute on function public.twingrid_kindred_proj(jsonb) from public, anon;
revoke execute on function public.twingrid_house_proj(jsonb) from public, anon;
revoke execute on function public.twingrid_house_valid(jsonb) from public, anon;
revoke execute on function public.twingrid_avatar_valid(jsonb) from public, anon;
revoke execute on function public.twingrid_place_counts(uuid) from public, anon;
revoke execute on function public.twingrid_lobby(jsonb) from public;
revoke execute on function public.twingrid_facet_scope(jsonb) from public;
revoke execute on function public.twingrid_house_public(jsonb, text[]) from public;
grant execute on function public.twingrid_kindred_proj(jsonb), public.twingrid_house_proj(jsonb), public.twingrid_house_valid(jsonb),
  public.twingrid_avatar_valid(jsonb), public.twingrid_place_counts(uuid) to authenticated, service_role;
grant execute on function public.twingrid_lobby(jsonb), public.twingrid_facet_scope(jsonb), public.twingrid_house_public(jsonb, text[])
  to anon, authenticated, service_role;

-- 5. The Room's owner settings (data.hero, data.face: the placed mouth and the picked character, PR #53) were written to keys no
--    projection carried, so every visitor saw the default mouth. Validated at the table, then named in every projection.
create or replace function public.twingrid_room_valid(d jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select (d->'hero' is null or (jsonb_typeof(d->'hero') = 'string' and d->>'hero' in ('look','portrait')))
     and (d->'face' is null or (jsonb_typeof(d->'face') = 'object'
          and jsonb_typeof(d->'face'->'x') = 'number' and (d->'face'->>'x')::numeric between 0 and 1
          and jsonb_typeof(d->'face'->'y') = 'number' and (d->'face'->>'y')::numeric between 0 and 1
          and jsonb_typeof(d->'face'->'w') = 'number' and (d->'face'->>'w')::numeric between 0 and 1))
$$;
revoke execute on function public.twingrid_room_valid(jsonb) from public, anon;
grant execute on function public.twingrid_room_valid(jsonb) to authenticated, service_role;
alter table public.twingrid_grids drop constraint if exists twingrid_grids_room_valid;
alter table public.twingrid_grids add constraint twingrid_grids_room_valid check (public.twingrid_room_valid(data)) not valid;
alter table public.twingrid_grids validate constraint twingrid_grids_room_valid;

create or replace function public.twingrid_lobby(d jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  with f as (
    select x from jsonb_array_elements(case when jsonb_typeof(d->'facets') = 'array' then d->'facets' else '[]'::jsonb end) x
    where public.twingrid_facet_scope(x) = 'lobby')
  select jsonb_strip_nulls(jsonb_build_object(
    'facets',   coalesce((select jsonb_agg(x) from f), '[]'::jsonb),
    'name',     d->'name',
    'tagline',  d->'tagline',
    'template', d->'template',
    'theme',    d->'theme',
    'house',    public.twingrid_house_public(d->'house', coalesce((select array_agg(x->>'name') from f), '{}'::text[])),
    'avatar',   d->'avatar',
    'hero',     d->'hero',
    'face',     d->'face'))
$$;

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
    'avatar',   d->'avatar',
    'hero',     d->'hero',
    'face',     d->'face',
    'kindred',  true))
$$;

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
    'avatar',      d->'avatar',
    'hero',        d->'hero',
    'face',        d->'face',
    'kindred',     true,
    'whole_house', true))
$$;

-- 6. Every Worker rate limit was a KV read then a KV put, and Workers KV has no compare-and-swap, so a parallel burst read the same
--    count and all passed (reproduced live against the visit counter). One row per key, one statement per hit, the increment and
--    the read atomic. Service role only; the Worker keeps its KV path as the fallback when this cannot be reached.
create table if not exists public.twingrid_rate (
  key        text primary key,
  bucket     bigint not null,
  n          integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.twingrid_rate enable row level security;
revoke select, insert, update, delete, truncate, references, trigger on public.twingrid_rate from anon, authenticated, service_role, public;
grant select, insert, update, delete on public.twingrid_rate to service_role;
create or replace function public.twingrid_rate_hit(p_key text, p_limit integer, p_bucket bigint) returns boolean
language sql volatile security definer
set search_path = ''
as $$
  insert into public.twingrid_rate as r (key, bucket, n, updated_at) values (p_key, p_bucket, 1, now())
  on conflict (key) do update
    set n = case when r.bucket = excluded.bucket then r.n + 1 else 1 end,
        bucket = excluded.bucket,
        updated_at = now()
  returning n > p_limit
$$;
revoke execute on function public.twingrid_rate_hit(text, integer, bigint) from public, anon, authenticated;
grant execute on function public.twingrid_rate_hit(text, integer, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 46. anon over HTTP with the publishable key: POST storage/v1/object/list/twingrid-media {"prefix":""} -> 400 or an empty array, never a
--     folder; GET storage/v1/object/public/twingrid-media/<a published persona's image> with NO key -> 200 image/webp
-- 47. anon: rpc twingrid_kindred_view -> 42501; rpc twingrid_place_counts -> 42501; rpc twingrid_kindred_proj -> 42501; rpc twingrid_lobby
--     -> 200 (it must stay callable: the public view runs it as the caller); GET twingrid_grids_public?select=id,data -> 200 with rows
-- 48. rolled back: service role inserts an accepted pair between two public grids; a stranger (authenticated, foreign sub) calling
--     twingrid_kindred_view(a, b) gets no 'kindred' key; the owner's sub gets 'kindred' true; the service role gets 'kindred' true
-- 49. rolled back: authenticated with a real sub INSERTs a grid whose image_url points at another account's folder -> 42501; the same
--     insert with its own folder -> 1 row
-- 50. rolled back: service role sets data.hero to 'bogus' -> 23514; data.face.y to 2 -> 23514; hero 'look' and face {0.5,0.6,0.2} -> 1 row;
--     twingrid_lobby(data) then carries both keys
-- 51. rolled back: twingrid_rate_hit('probe', 2, 1) three times -> false, false, true; bucket 2 -> false again; as anon -> 42501
