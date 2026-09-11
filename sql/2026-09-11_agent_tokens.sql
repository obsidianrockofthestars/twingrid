-- Personakind, agent write lane phase A (2026-09-11): a per-account token so an AI that already knows the owner
-- can fill the owner's own persona from outside the browser. Dylan's rulings of record (v18 picker, PLAN row 1.7):
-- MANY tokens per account, each with a LABEL, NO expiry (revoke by hand); an agent write always lands PRIVATE, the
-- owner flips the floor (that is enforced in the Worker write routes, not here).
--
-- The trust boundary lives in the Worker, not the page: the page never sees or stores a token hash. The page mints
-- through POST /api/agent/token (the Worker hashes the raw token with the service key and inserts here), lists through
-- the hash-free view below, and revokes through the Worker. So this table is written and read ONLY by the service role;
-- authenticated and anon have no grant on it at all, and the hash column can never reach a browser.
--
-- PHASE A only (additive): two new tables and one hash-free view. Nothing the live page reads changes, so there is no
-- phase B lock. The Worker routes and the MCP write tools ship on this same branch and are proven live before merge; the
-- 2026-09-11 adversarial review (PROMPT_adversarial_v18.md) probes this object set before any of it merges.

-- 1) the tokens. Service-role only for every operation; the hash never leaves the Worker.
create table if not exists public.twingrid_agent_tokens (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null,
  label        text not null default 'agent',
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists twingrid_agent_tokens_owner_idx on public.twingrid_agent_tokens (owner);

alter table public.twingrid_agent_tokens enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_agent_tokens from anon, authenticated, service_role, public;
revoke select on public.twingrid_agent_tokens from anon, authenticated, public;
grant select, insert, update on public.twingrid_agent_tokens to service_role;
-- No policy for anon or authenticated: they hold no grant, so the base table (hash and all) is unreachable from any
-- browser. The service role bypasses RLS; it is the only writer and the only reader of the hash.

-- 2) the hash-free list the page reads. A definer view (owner = postgres) so it can read a table the caller cannot,
-- narrowed to the caller's own live rows and stripped of token_hash. The Supabase advisor flags this as a
-- security_definer_view on purpose (rulebook database rule 6); the revoke below keeps it read-only (rule 1).
create or replace view public.twingrid_agent_tokens_mine
with (security_invoker = false) as
  select id, owner, label, created_at, last_used_at, revoked_at
  from public.twingrid_agent_tokens
  where public.twingrid_operates(owner);
revoke insert, update, delete, truncate, references, trigger on public.twingrid_agent_tokens_mine from anon, authenticated, service_role, public;
revoke select on public.twingrid_agent_tokens_mine from anon, public;
grant select on public.twingrid_agent_tokens_mine to authenticated;

-- 3) the write receipts. One row per agent write, so an owner can see what an outside agent did and when. Owner reads own;
-- the service role is the only writer.
create table if not exists public.twingrid_agent_writes (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null,
  grid_id    uuid not null,
  token_id   uuid,
  kind       text not null,
  n_written  int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists twingrid_agent_writes_grid_idx on public.twingrid_agent_writes (grid_id, created_at desc);

alter table public.twingrid_agent_writes enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_agent_writes from anon, authenticated, service_role, public;
revoke select on public.twingrid_agent_writes from anon, public;
grant select on public.twingrid_agent_writes to authenticated;
grant insert on public.twingrid_agent_writes to service_role;
create policy twingrid_agent_writes_select on public.twingrid_agent_writes for select using (public.twingrid_operates(owner));

-- probes (run after apply; expected results in the trailing comments). The publishable key is public by design.
-- A) as anon over HTTP with the publishable key:
--    GET /rest/v1/twingrid_agent_tokens?select=token_hash        -> 401/permission denied (no grant): the hash is unreachable.
--    GET /rest/v1/twingrid_agent_tokens_mine?select=*            -> [] (anon has no grant on the view).
--    GET /rest/v1/twingrid_agent_writes?select=*                 -> [] (no grant for anon).
-- B) as a signed-in stranger (a throwaway account) over HTTP:
--    GET /rest/v1/twingrid_agent_tokens?select=*                 -> 401/permission denied (no grant on the base table).
--    GET /rest/v1/twingrid_agent_tokens_mine?select=*            -> only rows where twingrid_operates(owner) is true, so [] for a stranger; never another owner's row, never a token_hash column (it is not in the view).
--    GET /rest/v1/twingrid_agent_writes?select=* on someone else's grid -> [] (the select policy is operates(owner)).
-- C) in SQL:
--    set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', '<stranger-uuid>')::text, true);
--    select count(*) from public.twingrid_agent_tokens;            -> ERROR 42501 permission denied (no grant).
--    select count(*) from public.twingrid_agent_tokens_mine;       -> 0 for a stranger, and the row set never carries token_hash.
--    insert into public.twingrid_agent_writes(owner,grid_id,kind) values(auth.uid(), gen_random_uuid(), 'answers'); -> ERROR 42501 (no insert grant for authenticated).
