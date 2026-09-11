-- 2026-09-11: Dylan's ruling (v16 picker, question 3): an object's owner written label is stripped from the public projection when the
-- object points at a facet that is not public, along with the facet itself. Before this, twingrid_house_public dropped the facet and kept
-- the label, so a stranger could read what the owner wrote about a private door (the 2026-09-10 adversarial review, finding 6).
-- One phase: the projection returns LESS than before and the page already falls back to the catalog label when an object has none.
-- Same signature, same owner, same grants; the Lobby view and the Kindred projection call it unchanged.
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
          coalesce((select jsonb_agg(case when it ? 'facet' and not ((it->>'facet') = any(lobby)) then (it - 'facet') - 'label' else it end)
                    from jsonb_array_elements(z.value) it), '[]'::jsonb)
        else z.value end)
      from jsonb_each(h->'zones') z), '{}'::jsonb))
  end
$$;
-- probes (run after apply; expected results in the trailing comments)
-- select public.twingrid_house_public('{"zones":{"thinking":[{"obj":"desk-lamp","facet":"core","label":"my lamp"},{"obj":"notebook","facet":"secret","label":"private note"},{"obj":"globe","label":"plain"}]}}'::jsonb, array['core']);
--   -> desk-lamp keeps facet and label; notebook keeps obj only (facet and label gone); globe keeps its label.
-- select public.twingrid_house_public(null, array[]::text[]);  -> null
-- select public.twingrid_house_public('{"room":"studio"}'::jsonb, array[]::text[]);  -> {"room":"studio"}
-- anon over HTTP with the publishable key: /rest/v1/twingrid_grids_public?select=data on a public grid whose object points at a private facet returns the object with neither facet nor label.
