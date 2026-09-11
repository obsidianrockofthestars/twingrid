-- Personakind, the avatar (A4, 2026-09-10): twingrid_grids.data.avatar validated in the database and projected to every reader.
--
-- avatar: { body, height, face, skin {depth, undertone}, hair {style, color}, facialHair, eyes,
--           look { top, bottom, onePiece, outer, shoes, head, accessories [up to 4], colors {top,bottom,onePiece,outer,shoes,head},
--                  fit {seatedCut, sideOpening, easyClosures, prostheticAccess, braceRoom, sensoryFriendly: booleans} } }
-- Every value is a KEY into docs/catalog/avatar.json (never free text, never a URL); the key lists below are GENERATED from that
-- file by the session that wrote this migration and tools/catalog_check.mjs asserts every catalog key appears here, quoted.
-- Jennifer's Step 2 and Step 3 specs are the source of the shape; adaptive and accessibility items are ordinary keys, never paid.
--
-- PHASE A only (additive), applied before the push: the validator, a check constraint that passes when avatar is absent
-- (0 of 17 rows carry one on 2026-09-10), and the Lobby, Kindred and Whole house projections gaining an avatar key. Today's page
-- ignores the new key. There is no phase B.

-- 1. The validator. Immutable so a check constraint may call it; every list is embedded on purpose.
create or replace function public.twingrid_avatar_valid(a jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  bodies text[] := array['standing','seated','wheelchair','cane','crutches','walker'];
  heights text[] := array['short','mid','tall'];
  faces text[] := array['oval','round','square','heart','long','diamond','triangle'];
  depths text[] := array['d1','d2','d3','d4','d5','d6','d7','d8'];
  undertones text[] := array['cool','neutral','warm','golden','olive','red'];
  hairs text[] := array['none','shaved','cropped','short','bob','shoulder','long','curly','coily','locs','braids','bun','afro'];
  haircolors text[] := array['black','brown','auburn','red','blond','grey','silver','white','violet','blue','teal','green','pink','coral'];
  facialhairs text[] := array['none','stubble','moustache','goatee','shortBeard','fullBeard'];
  eyes text[] := array['darkbrown','brown','amber','hazel','green','grey','blue','nearblack','violet','gold','teal'];
  tops text[] := array['tee','shirt','blouse','sweater','hoodie','tunic','vest','adaptiveTop'];
  bottoms text[] := array['trousers','jeans','skirt','shorts','leggings','adaptiveBottom'];
  onepieces text[] := array['dress','jumpsuit','coveralls','robe'];
  outers text[] := array['none','jacket','blazer','coat','cardigan','cape'];
  shoes text[] := array['sneakers','boots','flats','sandals','formal','adaptive'];
  heads text[] := array['none','cap','beanie','headwrap','hood','wideHat'];
  accessories text[] := array['glasses','sunglasses','hearingAid','cochlearImplant','necklace','scarf','backpack','pronounPin','watch','earrings'];
  colors text[] := array['violet','black','white','grey','navy','denim','olive','forest','teal','sky','mustard','rust','coral','pink','plum','sand'];
  s jsonb; h jsonb; l jsonb; c jsonb; f jsonb; it jsonb; k text;
begin
  if a is null then return true; end if;
  if jsonb_typeof(a) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(a) kk where kk not in ('body','height','face','skin','hair','facialHair','eyes','look')) then return false; end if;
  if a ? 'body' and not (jsonb_typeof(a->'body') = 'string' and (a->>'body') = any(bodies)) then return false; end if;
  if a ? 'height' and not (jsonb_typeof(a->'height') = 'string' and (a->>'height') = any(heights)) then return false; end if;
  if a ? 'face' and not (jsonb_typeof(a->'face') = 'string' and (a->>'face') = any(faces)) then return false; end if;
  if a ? 'facialHair' and not (jsonb_typeof(a->'facialHair') = 'string' and (a->>'facialHair') = any(facialhairs)) then return false; end if;
  if a ? 'eyes' and not (jsonb_typeof(a->'eyes') = 'string' and (a->>'eyes') = any(eyes)) then return false; end if;
  if a ? 'skin' then
    s := a->'skin'; if jsonb_typeof(s) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(s) kk where kk not in ('depth','undertone')) then return false; end if;
    if s ? 'depth' and not (jsonb_typeof(s->'depth') = 'string' and (s->>'depth') = any(depths)) then return false; end if;
    if s ? 'undertone' and not (jsonb_typeof(s->'undertone') = 'string' and (s->>'undertone') = any(undertones)) then return false; end if;
  end if;
  if a ? 'hair' then
    h := a->'hair'; if jsonb_typeof(h) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(h) kk where kk not in ('style','color')) then return false; end if;
    if h ? 'style' and not (jsonb_typeof(h->'style') = 'string' and (h->>'style') = any(hairs)) then return false; end if;
    if h ? 'color' and not (jsonb_typeof(h->'color') = 'string' and (h->>'color') = any(haircolors)) then return false; end if;
  end if;
  if a ? 'look' then
    l := a->'look'; if jsonb_typeof(l) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(l) kk where kk not in ('top','bottom','onePiece','outer','shoes','head','accessories','colors','fit')) then return false; end if;
    if l ? 'top' and not (jsonb_typeof(l->'top') = 'string' and (l->>'top') = any(tops)) then return false; end if;
    if l ? 'bottom' and not (jsonb_typeof(l->'bottom') = 'string' and (l->>'bottom') = any(bottoms)) then return false; end if;
    if l ? 'onePiece' and not (jsonb_typeof(l->'onePiece') = 'string' and ((l->>'onePiece') = '' or (l->>'onePiece') = any(onepieces))) then return false; end if;
    if l ? 'outer' and not (jsonb_typeof(l->'outer') = 'string' and (l->>'outer') = any(outers)) then return false; end if;
    if l ? 'shoes' and not (jsonb_typeof(l->'shoes') = 'string' and (l->>'shoes') = any(shoes)) then return false; end if;
    if l ? 'head' and not (jsonb_typeof(l->'head') = 'string' and (l->>'head') = any(heads)) then return false; end if;
    if l ? 'accessories' then
      if jsonb_typeof(l->'accessories') <> 'array' or jsonb_array_length(l->'accessories') > 4 then return false; end if;
      for it in select * from jsonb_array_elements(l->'accessories') loop
        if jsonb_typeof(it) <> 'string' or not ((it #>> '{}') = any(accessories)) then return false; end if;
      end loop;
    end if;
    if l ? 'colors' then
      c := l->'colors'; if jsonb_typeof(c) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(c) kk where kk not in ('top','bottom','onePiece','outer','shoes','head')) then return false; end if;
      for k in select * from jsonb_object_keys(c) loop
        if not (jsonb_typeof(c->k) = 'string' and (c->>k) = any(colors)) then return false; end if;
      end loop;
    end if;
    if l ? 'fit' then
      f := l->'fit'; if jsonb_typeof(f) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(f) kk where kk not in ('seatedCut','sideOpening','easyClosures','prostheticAccess','braceRoom','sensoryFriendly')) then return false; end if;
      for k in select * from jsonb_object_keys(f) loop
        if jsonb_typeof(f->k) <> 'boolean' then return false; end if;
      end loop;
    end if;
  end if;
  return true;
end
$$;

-- 2. The constraint. Passes when avatar is absent. NOT VALID then VALIDATE so the add never holds a long lock.
alter table public.twingrid_grids drop constraint if exists twingrid_grids_avatar_valid;
alter table public.twingrid_grids add constraint twingrid_grids_avatar_valid
  check (public.twingrid_avatar_valid(data->'avatar')) not valid;
alter table public.twingrid_grids validate constraint twingrid_grids_avatar_valid;

-- 3. Every projection gains the avatar (same allow-list discipline: a key reaches a reader only when named here). The avatar is
--    keys only, so the Lobby, the Kindred view and the Whole house all pass it through untouched. Bodies read off the live
--    database with pg_get_functiondef on 2026-09-10 before the one line was added to each.
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
    'avatar',   d->'avatar'))
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
    'kindred',     true,
    'whole_house', true))
$$;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 51. a full valid avatar. Expected: true
-- select public.twingrid_avatar_valid('{"body":"wheelchair","height":"tall","face":"heart","skin":{"depth":"d6","undertone":"golden"},"hair":{"style":"locs","color":"black"},"facialHair":"none","eyes":"amber","look":{"top":"hoodie","bottom":"jeans","onePiece":"","outer":"none","shoes":"sneakers","head":"beanie","accessories":["glasses","hearingAid"],"colors":{"top":"violet","bottom":"denim","shoes":"black","head":"grey"},"fit":{"seatedCut":true}}}'::jsonb);
--
-- 52. refused. Expected: false for each
-- select public.twingrid_avatar_valid('{"body":"flying"}'), public.twingrid_avatar_valid('{"look":{"top":"https://x"}}'),
--        public.twingrid_avatar_valid('{"look":{"accessories":["glasses","glasses","glasses","glasses","glasses"]}}'),
--        public.twingrid_avatar_valid('{"look":{"colors":{"top":"#ff0000"}}}'), public.twingrid_avatar_valid('{"look":{"fit":{"seatedCut":"yes"}}}'),
--        public.twingrid_avatar_valid('{"portrait":"x"}'), public.twingrid_avatar_valid('[]');
--
-- 53. absent passes, the constraint is present, and the Lobby projection carries the key. Expected: true, twingrid_grids_avatar_valid, {"a":1}
-- select public.twingrid_avatar_valid(null), (select conname from pg_constraint where conname='twingrid_grids_avatar_valid'),
--        public.twingrid_lobby('{"facets":[],"avatar":{"a":1}}'::jsonb)->'avatar';
