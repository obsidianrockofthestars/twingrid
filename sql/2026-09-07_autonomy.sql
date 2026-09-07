-- Personakind autonomy, the engine (M3, 2026-09-07): owner rules, the life log, the cron's receipts, the public feed.
--
-- PLAN.md section 3.2. One phase (everything here is new; nothing the live page reads changes), applied before the
-- Worker push as migration twingrid_autonomy. Hard boundaries (no private facet in an autonomous run, no links, no
-- purchases, no contact with a persona that is not Kindred, disclosure on every post) live in worker/api.js as code:
-- the tick composes from the Lobby view only and refuses a draft that trips a boundary, recording the refusal here.
--
-- Every relation: RLS on, the explicit revoke, then exactly the grants it needs (sql/README.md). The policy is the gate:
-- anon and authenticated keep table-level SELECT and the policy returns a stranger zero rows.

-- 1. Rules: one row per grid, written by its operator, read by the tick (service role).
create table if not exists public.twingrid_rules (
  grid_id     uuid primary key references public.twingrid_grids(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  mode        text not null default 'together' check (mode in ('private','manual','together','autopilot')),
  topics      text[] not null default '{}' check (cardinality(topics) <= 12 and char_length(array_to_string(topics, ' ')) <= 600),
  avoid       text[] not null default '{}' check (cardinality(avoid) <= 12 and char_length(array_to_string(avoid, ' ')) <= 600),
  max_per_day int  not null default 1 check (max_per_day between 0 and 3),
  hour_utc    int  not null default 15 check (hour_utc between 0 and 23),
  audience    text not null default 'public' check (audience in ('public','circle')),
  replies     text not null default 'propose' check (replies in ('act','propose','ask')),
  learning    text not null default 'propose' check (learning in ('propose','off')),
  updated_at  timestamptz not null default now()
);
alter table public.twingrid_rules enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_rules from anon, authenticated, service_role, public;
grant select on public.twingrid_rules to anon, authenticated, service_role;
grant insert, update on public.twingrid_rules to authenticated;
drop policy if exists twingrid_rules_select on public.twingrid_rules;
create policy twingrid_rules_select on public.twingrid_rules for select using (public.twingrid_operates(owner));
drop policy if exists twingrid_rules_insert on public.twingrid_rules;
create policy twingrid_rules_insert on public.twingrid_rules for insert with check (
  public.twingrid_operates(owner) and exists (select 1 from public.twingrid_grids g where g.id = grid_id and g.owner = owner));
drop policy if exists twingrid_rules_update on public.twingrid_rules;
create policy twingrid_rules_update on public.twingrid_rules for update
  using (public.twingrid_operates(owner))
  with check (public.twingrid_operates(owner) and exists (select 1 from public.twingrid_grids g where g.id = grid_id and g.owner = owner));
create index if not exists twingrid_rules_hour_idx on public.twingrid_rules (hour_utc, mode);

-- 2. The life log. Written by the Worker (service role) only; the operator reads it. Decisions land through the Worker
--    too (M4), so authenticated gets no UPDATE at all: table-level grants only, and "status only" cannot be a column grant.
create table if not exists public.twingrid_actions (
  id           bigint generated always as identity primary key,
  grid_id      uuid not null references public.twingrid_grids(id) on delete cascade,
  owner        uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('post','visit','reply','room_change','learning')),
  authorship   text not null check (authorship in ('AUTOPILOT','OWNER','TOGETHER','SCHEDULED')),
  status       text not null check (status in ('proposed','approved','declined','published','refused')),
  audience     text not null default 'public' check (audience in ('public','circle')),
  body         jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 4000),
  rule_ref     text check (rule_ref is null or char_length(rule_ref) <= 60),
  refusal      text check (refusal is null or char_length(refusal) <= 60),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  published_at timestamptz
);
alter table public.twingrid_actions enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_actions from anon, authenticated, service_role, public;
grant select on public.twingrid_actions to anon, authenticated, service_role;
grant insert, update on public.twingrid_actions to service_role;
drop policy if exists twingrid_actions_select on public.twingrid_actions;
create policy twingrid_actions_select on public.twingrid_actions for select using (public.twingrid_operates(owner));
create index if not exists twingrid_actions_grid_idx on public.twingrid_actions (grid_id, created_at desc);
create index if not exists twingrid_actions_pub_idx on public.twingrid_actions (status, published_at desc);

-- 3. The cron's own receipt. Service role only.
create table if not exists public.twingrid_action_runs (
  id               bigint generated always as identity primary key,
  ran_at           timestamptz not null default now(),
  grids_considered int not null default 0,
  proposed         int not null default 0,
  errors           jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array' and octet_length(errors::text) <= 8000)
);
alter table public.twingrid_action_runs enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_action_runs from anon, authenticated, service_role, public;
revoke select on public.twingrid_action_runs from anon, authenticated, public;
grant select, insert on public.twingrid_action_runs to service_role;

-- 4. The public feed: published, public-audience actions of personas that are themselves public and unsuspended.
--    Owned by postgres with security_invoker = false on purpose (same design as the Lobby view); read-only by rule 1.
create or replace view public.twingrid_actions_public
with (security_invoker = false, security_barrier = true) as
  select a.id, a.grid_id, a.kind, a.authorship, a.body, a.published_at
  from public.twingrid_actions a
  join public.twingrid_grids_public g on g.id = a.grid_id
  where a.status = 'published' and a.audience = 'public';
alter view public.twingrid_actions_public owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_actions_public from anon, authenticated, service_role, public;
grant select on public.twingrid_actions_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 24. anon reads the three tables and the view. Expected: rules 0, actions 0, runs ERROR permission denied, view 0 (nothing published yet)
-- begin; set local role anon; select (select count(*) from public.twingrid_rules), (select count(*) from public.twingrid_actions), (select count(*) from public.twingrid_actions_public); rollback;
-- begin; set local role anon; select count(*) from public.twingrid_action_runs; rollback;   -- ERROR 42501
--
-- 25. a signed-in stranger reads the same. Expected: 0, 0, 0
-- begin; set local role authenticated;
-- select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
-- select (select count(*) from public.twingrid_rules), (select count(*) from public.twingrid_actions), (select count(*) from public.twingrid_actions_public); rollback;
--
-- 26. a stranger inserts rules for a grid that is not theirs. Expected: ERROR new row violates row-level security policy
-- begin; set local role authenticated;
-- select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
-- insert into public.twingrid_rules (grid_id, owner) select id, owner from public.twingrid_grids_public limit 1; rollback;
--
-- 27. authenticated writes actions or the view. Expected: ERROR permission denied (no grant)
-- begin; set local role authenticated; insert into public.twingrid_actions (grid_id, owner, kind, authorship, status) values (gen_random_uuid(), gen_random_uuid(), 'post', 'OWNER', 'published'); rollback;
-- begin; set local role authenticated; delete from public.twingrid_actions_public; rollback;
--
-- 28. over HTTP with the publishable key: GET twingrid_rules 200 [], GET twingrid_actions 200 [], GET twingrid_action_runs 401,
--     GET twingrid_actions_public 200 [], POST twingrid_actions 401, PATCH twingrid_actions_public 401.
