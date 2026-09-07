-- Personakind Places and business personas (M7, 2026-09-07). PLAN.md section 3.5 and 5, M7.
--
-- A business account claims a Place (kind, name, blurb, a room key), gives it approved knowledge (one PLACE facet of cells),
-- verified destinations (sign, menu, booking, shelf, events, map: https links only), and staffs it with one or more of its
-- public personas. Strangers see a Place only once a moderator verified it (token on the business site or an email from its
-- domain, recorded with method and evidence); the staff persona answers from its own public facets plus the Place knowledge
-- under the business boundaries in the guard (no invented price, availability or booking, no undisclosed sponsorship).
-- Counts (visits, link clicks) are per Place per day with no visitor identity.
--
-- One phase (everything new; the accounts column is additive with a default), applied before the push as twingrid_places.
-- Operators write their own Place rows under RLS; verification and counting are Worker writes with the service key.

-- 0. Business accounts
alter table public.twingrid_accounts add column if not exists kind text not null default 'person' check (kind in ('person','business'));
-- twingrid_accounts is COLUMN-granted (2026-08-29); without these the places insert policy, which reads a.kind, fails 42501 (probe 39, applied as twingrid_accounts_new_column_grants)
grant select (kind) on public.twingrid_accounts to anon, authenticated;
grant insert (kind), update (kind) on public.twingrid_accounts to authenticated;

-- 1. Places
-- knowledge is one facet of cells: up to five of CONTEXT, DO, DONT, GATES, VOICE, each a string of at most 4000 chars
create or replace function public.twingrid_place_knowledge_valid(k jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select k is not null and jsonb_typeof(k) = 'object'
    and not exists (select 1 from jsonb_each(k) e where e.key not in ('CONTEXT','DO','DONT','GATES','VOICE') or jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') > 4000)
$$;
create table if not exists public.twingrid_places (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  kind         text not null default 'other' check (kind in ('shop','cafe','studio','salon','office','gallery','event_space','other')),
  name         text not null check (char_length(name) between 1 and 80),
  blurb        text not null default '' check (char_length(blurb) <= 200),
  room         text not null default 'office' check (room in ('studio','library','workshop','porch','observatory','kitchen','garden','office')),
  knowledge    jsonb not null default '{}'::jsonb check (public.twingrid_place_knowledge_valid(knowledge)),
  verified_at  timestamptz,
  verification jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.twingrid_places enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_places from anon, authenticated, service_role, public;
grant select on public.twingrid_places to anon, authenticated, service_role;
grant insert, update, delete on public.twingrid_places to authenticated;
grant update on public.twingrid_places to service_role;
drop policy if exists twingrid_places_select on public.twingrid_places;
create policy twingrid_places_select on public.twingrid_places for select using (public.twingrid_operates(owner));
drop policy if exists twingrid_places_insert on public.twingrid_places;
create policy twingrid_places_insert on public.twingrid_places for insert with check (
  public.twingrid_operates(owner) and exists (select 1 from public.twingrid_accounts a where a.id = owner and a.kind = 'business' and a.is_suspended = false));
drop policy if exists twingrid_places_update on public.twingrid_places;
create policy twingrid_places_update on public.twingrid_places for update using (public.twingrid_operates(owner)) with check (public.twingrid_operates(owner));
drop policy if exists twingrid_places_delete on public.twingrid_places;
create policy twingrid_places_delete on public.twingrid_places for delete using (public.twingrid_operates(owner));
-- verification is the moderator's, never the operator's: an operator write keeps the old values; a change to name or knowledge clears it
create or replace function public.twingrid_place_guard() returns trigger
language plpgsql   -- SECURITY INVOKER on purpose: a definer trigger sees current_user as its owner and the operator branch never runs (applied as twingrid_places_guard_invoker)
set search_path = 'public', 'pg_temp'
as $$
begin
  if tg_op = 'INSERT' then new.verified_at := null; new.verification := null; return new; end if;
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then   -- the role is the signal, not a JWT claim (applied as twingrid_places_guard_current_user)
    new.verified_at := old.verified_at; new.verification := old.verification;
    if new.name is distinct from old.name or new.knowledge is distinct from old.knowledge or new.owner is distinct from old.owner then
      new.verified_at := null; new.verification := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;
drop trigger if exists twingrid_place_guard on public.twingrid_places;
create trigger twingrid_place_guard before insert or update on public.twingrid_places for each row execute function public.twingrid_place_guard();

-- 2. Links: one per slot, https only, verified with the Place
create table if not exists public.twingrid_place_links (
  place_id    uuid not null references public.twingrid_places(id) on delete cascade,
  slot        text not null check (slot in ('sign','menu','booking','shelf','events','map')),
  url         text not null check (url ~ '^https://[^\s/$.?#][^\s]*$' and char_length(url) <= 500),   -- a {0,500} count here failed 2201B on the first probe; fixed as twingrid_places_link_url_fix
  label       text not null default '' check (char_length(label) <= 60),
  verified_at timestamptz,
  primary key (place_id, slot)
);
alter table public.twingrid_place_links enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_place_links from anon, authenticated, service_role, public;
grant select on public.twingrid_place_links to anon, authenticated, service_role;
grant insert, update, delete on public.twingrid_place_links to authenticated;
grant update on public.twingrid_place_links to service_role;
drop policy if exists twingrid_place_links_all on public.twingrid_place_links;
create policy twingrid_place_links_all on public.twingrid_place_links for all
  using (exists (select 1 from public.twingrid_places p where p.id = place_id and public.twingrid_operates(p.owner)))
  with check (exists (select 1 from public.twingrid_places p where p.id = place_id and public.twingrid_operates(p.owner)));
-- an operator write to a link clears its verification (a new URL is a new destination)
create or replace function public.twingrid_place_link_guard() returns trigger
language plpgsql   -- SECURITY INVOKER on purpose: a definer trigger sees current_user as its owner and the operator branch never runs (applied as twingrid_places_guard_invoker)
set search_path = 'public', 'pg_temp'
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' or new.url is distinct from old.url then new.verified_at := null; else new.verified_at := old.verified_at; end if;
  end if;
  return new;
end
$$;
drop trigger if exists twingrid_place_link_guard on public.twingrid_place_links;
create trigger twingrid_place_link_guard before insert or update on public.twingrid_place_links for each row execute function public.twingrid_place_link_guard();

-- 3. Staff: a public persona of the same owner
create table if not exists public.twingrid_place_staff (
  place_id uuid not null references public.twingrid_places(id) on delete cascade,
  grid_id  uuid not null references public.twingrid_grids(id) on delete cascade,
  role     text not null default '' check (char_length(role) <= 40),
  added_at timestamptz not null default now(),
  primary key (place_id, grid_id)
);
alter table public.twingrid_place_staff enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_place_staff from anon, authenticated, service_role, public;
grant select on public.twingrid_place_staff to anon, authenticated, service_role;
grant insert, update, delete on public.twingrid_place_staff to authenticated;
drop policy if exists twingrid_place_staff_all on public.twingrid_place_staff;
create policy twingrid_place_staff_all on public.twingrid_place_staff for all
  using (exists (select 1 from public.twingrid_places p where p.id = place_id and public.twingrid_operates(p.owner)))
  with check (exists (select 1 from public.twingrid_places p join public.twingrid_grids g on g.id = grid_id and g.owner = p.owner where p.id = place_id and public.twingrid_operates(p.owner)));

-- 4. Counts without identity
create table if not exists public.twingrid_place_hits (
  place_id uuid not null references public.twingrid_places(id) on delete cascade,
  day      date not null,
  kind     text not null check (kind in ('visit','sign','menu','booking','shelf','events','map')),
  count    int not null default 1 check (count >= 1),
  primary key (place_id, day, kind)
);
alter table public.twingrid_place_hits enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_place_hits from anon, authenticated, service_role, public;
revoke select on public.twingrid_place_hits from anon, authenticated, public;
grant select, insert, update on public.twingrid_place_hits to service_role;
create or replace function public.twingrid_place_hit(p_place uuid, p_kind text) returns integer
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v int;
begin
  if not exists (select 1 from public.twingrid_places p where p.id = p_place and p.verified_at is not null) then return -1; end if;
  if p_kind not in ('visit','sign','menu','booking','shelf','events','map') then return -1; end if;
  insert into public.twingrid_place_hits (place_id, day, kind, count) values (p_place, (now() at time zone 'utc')::date, p_kind, 1)
  on conflict (place_id, day, kind) do update set count = public.twingrid_place_hits.count + 1 returning count into v;
  return v;
end
$$;
revoke execute on function public.twingrid_place_hit(uuid, text) from public, anon, authenticated;
grant execute on function public.twingrid_place_hit(uuid, text) to service_role;
-- the operator's own totals
create or replace function public.twingrid_place_counts(p_place uuid) returns table (kind text, total bigint)
language sql stable security definer
set search_path = ''
as $$
  select h.kind, sum(h.count) from public.twingrid_place_hits h join public.twingrid_places p on p.id = h.place_id
  where h.place_id = p_place and public.twingrid_operates(p.owner) group by h.kind order by h.kind
$$;
grant execute on function public.twingrid_place_counts(uuid) to authenticated, service_role;

-- 5. The public faces: verified Places, their verified links, their public staff
create or replace view public.twingrid_places_public
with (security_invoker = false, security_barrier = true) as
  select p.id, p.owner, p.kind, p.name, p.blurb, p.room, p.verified_at, p.updated_at
  from public.twingrid_places p join public.twingrid_accounts a on a.id = p.owner
  where p.verified_at is not null and a.is_suspended = false and a.kind = 'business';
alter view public.twingrid_places_public owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_places_public from anon, authenticated, service_role, public;
grant select on public.twingrid_places_public to anon, authenticated;
create or replace view public.twingrid_place_links_public
with (security_invoker = false, security_barrier = true) as
  select l.place_id, l.slot, l.url, l.label
  from public.twingrid_place_links l join public.twingrid_places_public p on p.id = l.place_id
  where l.verified_at is not null;
alter view public.twingrid_place_links_public owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_place_links_public from anon, authenticated, service_role, public;
grant select on public.twingrid_place_links_public to anon, authenticated;
create or replace view public.twingrid_place_staff_public
with (security_invoker = false, security_barrier = true) as
  select s.place_id, s.grid_id, s.role, g.name as persona_name
  from public.twingrid_place_staff s join public.twingrid_places_public p on p.id = s.place_id join public.twingrid_grids_public g on g.id = s.grid_id;
alter view public.twingrid_place_staff_public owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_place_staff_public from anon, authenticated, service_role, public;
grant select on public.twingrid_place_staff_public to anon, authenticated;
-- the knowledge a staff persona may answer from, for the Worker: verified Places only, and only for a persona on its staff
create or replace function public.twingrid_place_knowledge(p_place uuid, p_grid uuid) returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('name', p.name, 'kind', p.kind, 'blurb', p.blurb, 'knowledge', p.knowledge,
           'links', coalesce((select jsonb_agg(jsonb_build_object('slot', l.slot, 'label', l.label)) from public.twingrid_place_links_public l where l.place_id = p.id), '[]'::jsonb))
  from public.twingrid_places p join public.twingrid_places_public pp on pp.id = p.id
  where p.id = p_place and exists (select 1 from public.twingrid_place_staff s where s.place_id = p.id and s.grid_id = p_grid)
$$;
revoke execute on function public.twingrid_place_knowledge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.twingrid_place_knowledge(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 38. anon: places 0, links 0, staff 0, places_public 0, place_hits 42501; insert into places 42501
-- 39. a person account (kind person) inserting a place: RLS 42501; after set kind = business (rolled back) the insert succeeds
--     with verified_at forced null even when supplied; the operator setting verified_at by update: stays null; a name change
--     after a service-role verification clears it again
-- 40. service role: twingrid_place_hit on an unverified place -1; on a verified one 1 then 2; anon call 42501
-- 41. HTTP with the publishable key: GET places 200 [], GET places_public 200 [], GET place_hits 401, POST places 401,
--     POST rpc/twingrid_place_hit 401, POST rpc/twingrid_place_knowledge 401
