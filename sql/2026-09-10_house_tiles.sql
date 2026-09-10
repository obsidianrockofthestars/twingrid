-- Personakind, the Home on tiles (A3, 2026-09-10): twingrid_house_valid() widened so a zone object may carry a tile position.
--
-- PHASE A only (additive), applied before the push: the validator accepts two optional keys on every zone item, x and y,
-- each an integer 0 to 7 (the Home is an 8 by 8 tile room; the page clamps a footprint inside it and the renderer
-- re-places any object whose saved tile no longer fits). Everything the 2026-09-07 validator accepted is still accepted;
-- the existing check constraint twingrid_grids_house_valid calls this function by name and needs no change. The Lobby,
-- Kindred and Whole house projections pass x and y through untouched (twingrid_house_public only strips facet).
-- The catalog lists below are still GENERATED from docs/catalog/objects.json; tools/catalog_check.mjs asserts every id
-- against the newest validator file (this one). There is no phase B.

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
          if exists (select 1 from jsonb_object_keys(it) kk where kk not in ('obj','facet','label','x','y')) then return false; end if;
          if it ? 'x' and not (jsonb_typeof(it->'x') = 'number' and (it->'x')::text ~ '^[0-7]$') then return false; end if;
          if it ? 'y' and not (jsonb_typeof(it->'y') = 'number' and (it->'y')::text ~ '^[0-7]$') then return false; end if;
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

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 48. tile positions accepted. Expected: true
-- select public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":0,"y":3}],"resting":[{"obj":"armchair","x":7,"y":7}]}}'::jsonb);
--
-- 49. bad tiles refused. Expected: false for each
-- select public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":8,"y":0}]}}'),   -- 8 is off the room
--        public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":-1,"y":0}]}}'),  -- negative
--        public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":1.5,"y":0}]}}'), -- fraction
--        public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":"1","y":0}]}}'), -- string
--        public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","z":1}]}}');         -- unknown key
--
-- 50. the 2026-09-07 probe 19 still passes (nothing narrowed). Expected: true
-- select public.twingrid_house_valid('{"status":"Sketching","mood":"curious","room":"studio","zones":{"thinking":[{"obj":"desk-lamp","facet":"core","label":"The lamp"}],"resting":[{"obj":"armchair"}],"memory":[],"social":{"open":true,"starters":["Ask me about the lamp"]}}}'::jsonb);
