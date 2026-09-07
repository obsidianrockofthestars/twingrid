-- Personakind rooms, step 1 (2026-09-07): per-facet scope and the Lobby projection.
--
-- Every facet in twingrid_grids.data.facets[] may carry a scope:
--   'house'    the owner only (the default for every facet except core and vibe)
--   'visiting' stored now, rendered as house until Kindred (mutual links) ships
--   'lobby'    the public persona: strangers, Explore, the MCP connector, hosted chat
--              for anyone who is not the owner (the default for core and vibe, which is
--              exactly what the public page rendered before this migration)
--
-- Before this migration the whole data JSON of a public grid was readable by anyone
-- through PostgREST, so a client-side "public view" would have hidden nothing.
-- After it:
--   * twingrid_grids is readable by its operator only (owner, or operator of an official
--     account). anon loses SELECT on the table entirely.
--   * twingrid_grids_public is a view that carries public, unsuspended rows with data
--     replaced by twingrid_lobby(data). It is owned by postgres and runs with the owner's
--     rights on purpose (security_invoker = false): the view's WHERE clause is the public
--     filter, and its projection is the only shape of data a non-operator can ever read.
--     The Supabase advisor flags this as security_definer_view; that is the design, and
--     the probes at the bottom of this file are what prove it.
--
-- Two phases, because the database is production and there is no branch:
--   PHASE A (additive: the two functions and the view) runs BEFORE the page and Worker
--   that read the view are pushed. Nothing that exists today changes behaviour.
--   PHASE B (the lockdown: policy and revoke) runs AFTER the push is live and proven,
--   because the old page reads public rows off the table and would go blank in between.
-- Then the probes at the bottom, and sql/attack.sql probes 13 to 18.

-- ===================== PHASE A =====================

-- 1. Scope of one facet. Missing or unknown scope falls back to the pre-migration behaviour.
create or replace function public.twingrid_facet_scope(f jsonb) returns text
language sql immutable strict
set search_path = ''
as $$
  select case
    when f->>'scope' in ('house','visiting','lobby') then f->>'scope'
    when f->>'name' in ('core','vibe') then 'lobby'
    else 'house'
  end
$$;

-- 2. The Lobby projection of a grid's data. Allow-list of top-level keys on purpose:
--    anything the editor adds later stays in the house until it is named here.
create or replace function public.twingrid_lobby(d jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'facets', coalesce((
      select jsonb_agg(f)
      from jsonb_array_elements(case when jsonb_typeof(d->'facets') = 'array' then d->'facets' else '[]'::jsonb end) f
      where public.twingrid_facet_scope(f) = 'lobby'), '[]'::jsonb),
    'name',     d->'name',
    'tagline',  d->'tagline',
    'template', d->'template',
    'theme',    d->'theme'))
$$;

-- 3. The public view. Same columns the page and the Worker read today, data projected.
create or replace view public.twingrid_grids_public
with (security_invoker = false, security_barrier = true) as
  select g.id, g.owner, g.name, g.is_public, g.image_url, g.voice_id, g.created_at, g.updated_at,
         public.twingrid_lobby(g.data) as data
  from public.twingrid_grids g
  where g.is_public = true
    and g.is_suspended = false
    and not public.twingrid_owner_suspended(g.owner);

alter view public.twingrid_grids_public owner to postgres;
-- Supabase default privileges hand every NEW relation ALL to anon and authenticated (not PUBLIC), so a
-- "revoke all from public" leaves them intact. This view is auto-updatable and runs as its owner, so an
-- anon UPDATE through it would write the base table around RLS. Found by the HTTP probe on 2026-09-07
-- (PATCH answered 204 for about two minutes live) and closed by the explicit revoke below.
-- Rule from it: every new table or view on this project starts with this revoke, then the one grant it needs.
revoke insert, update, delete, truncate, references, trigger on public.twingrid_grids_public from anon, authenticated, service_role, public;
grant select on public.twingrid_grids_public to anon, authenticated;

-- ===================== PHASE B (after the push is live) =====================

-- 4. The base table: operator only. The public arm of the select policy is gone.
drop policy if exists twingrid_select on public.twingrid_grids;
create policy twingrid_select on public.twingrid_grids
  for select using (public.twingrid_operates(owner));
-- anon keeps table-level SELECT on purpose: the policy above returns it zero rows, and revoking the grant
-- instead (tried live 2026-09-07 for about a minute) made every anon read of twingrid_accounts fail 42501,
-- because that table's select policy subqueries twingrid_grids. The policy is the gate, not the grant.

-- 5. twingrid_accounts_select decided "has a public persona" by subquerying twingrid_grids under the caller's
--    RLS; with the table operator-only that arm went dark for everyone but the owner (Explore lost its
--    handles, the MCP connector found no accounts). The Lobby view runs as its owner and already carries the
--    public and suspension filters, so the policy asks the view instead.
drop policy if exists twingrid_accounts_select on public.twingrid_accounts;
create policy twingrid_accounts_select on public.twingrid_accounts
  for select using (
    public.twingrid_operates(id)
    or (is_suspended = false and (
      exists (select 1 from public.twingrid_personas p where p.owner = twingrid_accounts.id and p.is_public and p.is_suspended = false)
      or exists (select 1 from public.twingrid_grids_public g where g.owner = twingrid_accounts.id)
    ))
  );

-- ---------------------------------------------------------------------------
-- Probes (each block separately; expected result in the comment)
-- ---------------------------------------------------------------------------
-- 13. anon reads the table. Expected: 0 rows (the grant stays, the policy returns nothing)
--     (over HTTP: GET /rest/v1/twingrid_grids?select=id,data with the publishable key answers 200 [])
-- begin; set local role anon; select count(*) from public.twingrid_grids; rollback;
--
-- 13b. anon reads accounts. Expected: every account with a public, unsuspended persona (via the view)
-- begin; set local role anon; select handle from public.twingrid_accounts order by handle; rollback;
--
-- 14. authenticated stranger reads the table. Expected: 0 rows
-- begin; set local role authenticated;
-- select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
-- select count(*) from public.twingrid_grids; rollback;
--
-- 15. anon reads the view. Expected: only public rows, and every facet in data carries scope lobby
-- begin; set local role anon;
-- select count(*) filter (where not is_public) as private_rows,
--        count(*) filter (where exists (select 1 from jsonb_array_elements(data->'facets') f where public.twingrid_facet_scope(f) <> 'lobby')) as house_leaks
-- from public.twingrid_grids_public; rollback;            -- both 0
--
-- 16. anon writes the view. Expected: ERROR permission denied for view twingrid_grids_public
--     (over HTTP: PATCH, DELETE and POST on /rest/v1/twingrid_grids_public with the publishable key answer 401 42501)
-- begin; set local role anon; update public.twingrid_grids_public set name='x'; rollback;
--
-- 17. authenticated writes the view. Expected: ERROR permission denied for view twingrid_grids_public
-- begin; set local role authenticated; delete from public.twingrid_grids_public; rollback;
--
-- 18. the projection itself. Expected: facets = [core] only, theme kept, nothing else
-- select public.twingrid_lobby('{"facets":[{"name":"core"},{"name":"vibe","scope":"house"},{"name":"x","scope":"visiting"},{"name":"y","scope":"lobby","cells":{}}],"theme":"nebula","secret":1}'::jsonb);
--   -> {"facets":[{"name":"core"},{"name":"y","scope":"lobby","cells":{}}],"theme":"nebula"}
