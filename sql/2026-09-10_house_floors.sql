-- Personakind, the floors (review finding 7, 2026-09-10 evening): the Home is a cutaway with three floors, so y is a floor index
-- 0 to 2, not the 0 to 7 tile row the isometric draw of the same morning accepted. twingrid_house_valid() narrowed on y only.
-- Checked first: 0 of 17 rows carry a house, so no stored row can fail the constraint (probe 57). Everything else unchanged.
-- The catalog lists are still GENERATED from docs/catalog/objects.json; tools/catalog_check.mjs now asserts against the newest
-- house validator file by name, which is this one. There is no phase B.

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
  if exists (select 1 from jsonb_object_keys(h) kk where kk not in ('status','mood','room','zones','show')) then return false; end if;
  if h ? 'show' and jsonb_typeof(h->'show') <> 'boolean' then return false; end if;
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
          if it ? 'y' and not (jsonb_typeof(it->'y') = 'number' and (it->'y')::text ~ '^[0-2]$') then return false; end if;
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
-- 57. nothing stored can fail. Expected: 0
-- select count(*) from public.twingrid_grids where data ? 'house';
--
-- 58. floors 0 to 2 accepted, 3 refused, x still 0 to 7. Expected: true, true, false, true, false
-- select public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":0,"y":0}]}}'), public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":7,"y":2}]}}'),
--        public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":0,"y":3}]}}'), public.twingrid_house_valid('{"show":true,"room":"studio"}'), public.twingrid_house_valid('{"zones":{"thinking":[{"obj":"desk-lamp","x":8,"y":0}]}}');
