-- Personakind, the Home (M1, 2026-09-07): twingrid_grids.data.house validated in the database and projected to the Lobby.
--
-- house: { status (0..80 chars), mood (key), room (key),
--          zones: { thinking [up to 6], resting [up to 4], memory [up to 6]  each item {obj: catalog id, facet?: 0..40, label?: 0..40},
--                   social { open: boolean, starters: [up to 3 strings of 0..120] } } }
-- The catalog lists below are GENERATED from docs/catalog/objects.json (tools/catalog_check.mjs asserts every
-- id, mood and room in the JSON appears here). Edit the JSON, regenerate this file, never hand-edit the lists.
--
-- PHASE A only (additive), applied before the push: a validator, a check constraint that passes when house is
-- absent (0 of 17 rows carried one on 2026-09-07), and the Lobby projection gaining a house key with the facet
-- link stripped from any object that points at a facet the owner kept Private or Kindred. Today's page ignores
-- the new key. There is no phase B.

-- 1. The validator. Immutable so a check constraint may call it; every list is embedded on purpose.
create or replace function public.twingrid_house_valid(h jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  moods text[] := array['calm','curious','focused','playful','tired','fired-up','quiet','celebrating'];
  rooms text[] := array['studio','library','workshop','porch','observatory','kitchen','garden','office'];
  cat   jsonb  := '{"thinking":["desk-lamp","notebook","whiteboard","chalkboard","blueprint","compass","microscope","typewriter","laptop","coffee-mug","sticky-notes","globe","abacus","pencil-cup"],"resting":["armchair","hammock","teapot","record-player","houseplant","cat-bed","window-seat","fireplace","bathtub","rug","headphones","sleeping-mask"],"memory":["photo-frame","bookshelf","trophy","postcard","keepsake-box","map-pin","jar-of-shells","diary","medal","old-key","letter-stack","pressed-flower","snow-globe","ticket-stub"]}'::jsonb;
  caps  jsonb  := '{"thinking":6,"resting":4,"memory":6}'::jsonb;
  z jsonb; s jsonb; it jsonb; k text;
begin
  if h is null then return true; end if;
  if jsonb_typeof(h) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(h) kk where kk not in ('status','mood','room','zones')) then return false; end if;
  if h ? 'status' and (jsonb_typeof(h->'status') <> 'string' or char_length(h->>'status') > 80) then return false; end if;
  if h ? 'mood' and not (jsonb_typeof(h->'mood') = 'string' and (h->>'mood') = any(moods)) then return false; end if;
  if h ? 'room' and not (jsonb_typeof(h->'room') = 'string' and (h->>'room') = any(rooms)) then return false; end if;
  if h ? 'zones' then
    z := h->'zones';
    if jsonb_typeof(z) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(z) kk where kk not in ('thinking','resting','memory','social')) then return false; end if;
    foreach k in array array['thinking','resting','memory'] loop
      if z ? k then
        if jsonb_typeof(z->k) <> 'array' or jsonb_array_length(z->k) > (caps->>k)::int then return false; end if;
        for it in select * from jsonb_array_elements(z->k) loop
          if jsonb_typeof(it) <> 'object' then return false; end if;
          if exists (select 1 from jsonb_object_keys(it) kk where kk not in ('obj','facet','label')) then return false; end if;
          if not (jsonb_typeof(it->'obj') = 'string' and (cat->k) ? (it->>'obj')) then return false; end if;
          if it ? 'facet' and (jsonb_typeof(it->'facet') <> 'string' or char_length(it->>'facet') > 40) then return false; end if;
          if it ? 'label' and (jsonb_typeof(it->'label') <> 'string' or char_length(it->>'label') > 40) then return false; end if;
        end loop;
      end if;
    end loop;
    if z ? 'social' then
      s := z->'social';
      if jsonb_typeof(s) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(s) kk where kk not in ('open','starters')) then return false; end if;
      if s ? 'open' and jsonb_typeof(s->'open') <> 'boolean' then return false; end if;
      if s ? 'starters' then
        if jsonb_typeof(s->'starters') <> 'array' or jsonb_array_length(s->'starters') > 3 then return false; end if;
        for it in select * from jsonb_array_elements(s->'starters') loop
          if jsonb_typeof(it) <> 'string' or char_length(it #>> '{}') > 120 then return false; end if;
        end loop;
      end if;
    end if;
  end if;
  return true;
end
$$;

-- 2. The constraint. Passes when house is absent. NOT VALID then VALIDATE so the add never holds a long lock.
alter table public.twingrid_grids drop constraint if exists twingrid_grids_house_valid;
alter table public.twingrid_grids add constraint twingrid_grids_house_valid
  check (public.twingrid_house_valid(data->'house')) not valid;
alter table public.twingrid_grids validate constraint twingrid_grids_house_valid;

-- 3. The Lobby shape of a house: the object stays, the door closes. An object whose facet is not Public loses its facet key.
create or replace function public.twingrid_house_public(h jsonb, lobby text[]) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case
    when h is null or jsonb_typeof(h) <> 'object' then null
    when not (h ? 'zones') or jsonb_typeof(h->'zones') <> 'object' then h
    else h || jsonb_build_object('zones', coalesce((
      select jsonb_object_agg(z.key,
        case when z.key in ('thinking','resting','memory') and jsonb_typeof(z.value) = 'array' then
          coalesce((select jsonb_agg(case when it ? 'facet' and not ((it->>'facet') = any(lobby)) then it - 'facet' else it end)
                    from jsonb_array_elements(z.value) it), '[]'::jsonb)
        else z.value end)
      from jsonb_each(h->'zones') z), '{}'::jsonb))
  end
$$;

-- 4. The Lobby projection gains the house (same allow-list discipline as before: a key reaches strangers only when named here).
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
    'house',    public.twingrid_house_public(d->'house', coalesce((select array_agg(x->>'name') from f), '{}'::text[]))))
$$;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 19. valid house. Expected: true
-- select public.twingrid_house_valid('{"status":"Sketching","mood":"curious","room":"studio","zones":{"thinking":[{"obj":"desk-lamp","facet":"core","label":"The lamp"}],"resting":[{"obj":"armchair"}],"memory":[],"social":{"open":true,"starters":["Ask me about the lamp"]}}}'::jsonb);
--
-- 20. invalid houses. Expected: false for each
-- select public.twingrid_house_valid('{"mood":"grumpy"}'), public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"armchair"}]}}'),  -- armchair is a resting object
--        public.twingrid_house_valid('{"zones":{"resting":[{"obj":"armchair"},{"obj":"armchair"},{"obj":"armchair"},{"obj":"armchair"},{"obj":"armchair"}]}}'),  -- 5 > 4
--        public.twingrid_house_valid('{"secret":1}'), public.twingrid_house_valid('{"zones":{"social":{"open":"yes"}}}'), public.twingrid_house_valid('"text"');
--
-- 21. the constraint refuses through a real row, then a valid house round-trips, all rolled back.
-- do $$ declare gid uuid; got jsonb; begin
--   select id into gid from public.twingrid_grids limit 1;
--   begin update public.twingrid_grids set data = data || '{"house":{"mood":"grumpy"}}' where id = gid; raise exception 'constraint did not fire';
--   exception when check_violation then raise notice 'REFUSED as expected: %', sqlerrm; end;
--   update public.twingrid_grids set data = data || '{"house":{"status":"Round trip","mood":"calm","room":"porch","zones":{"memory":[{"obj":"old-key","facet":"gates"}],"social":{"open":false,"starters":[]}}}}' where id = gid;
--   select data->'house' into got from public.twingrid_grids where id = gid; raise notice 'round trip: %', got;
--   raise exception 'rollback on purpose';
-- end $$;
--
-- 22. the projection strips a private door and keeps a public one. Expected: memory[0] has no facet, thinking[0] keeps facet core
-- select public.twingrid_lobby('{"facets":[{"name":"core"},{"name":"gates","scope":"house"}],"house":{"zones":{"thinking":[{"obj":"desk-lamp","facet":"core"}],"memory":[{"obj":"old-key","facet":"gates","label":"x"}]}}}'::jsonb) -> 'house';
--
-- 23. a row with no house projects with no house key. Expected: no "house" key in the output
-- select public.twingrid_lobby('{"facets":[{"name":"core"}],"theme":"nebula"}'::jsonb);
