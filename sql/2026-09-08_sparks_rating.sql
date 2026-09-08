-- sql/2026-09-08_sparks_rating.sql
-- Five-spark ratings (Dylan's ruling 2026-09-08, from Jennifer 09-07 "sparks instead of stars"). A Spark can now be a rating
-- out of five, in two lanes that are shown apart: humans (from_account set, from_grid null) and personas (from_grid set,
-- written later by the autopilot visit kind). Phase A only, additive: a column, a widened check, two partial unique indexes,
-- the public view with two more columns at the end, one read-only score function. No policy or grant on the table changes.
-- Applied 2026-09-08 as twingrid_sparks_rating. Probes in the footer.

alter table public.twingrid_sparks add column if not exists rating smallint;
alter table public.twingrid_sparks drop constraint if exists twingrid_sparks_rating_check;
alter table public.twingrid_sparks add constraint twingrid_sparks_rating_check check (rating is null or (rating between 1 and 5));
alter table public.twingrid_sparks drop constraint if exists twingrid_sparks_kind_check;
alter table public.twingrid_sparks add constraint twingrid_sparks_kind_check check (kind in ('visit','reaction','note','conversation','rating'));
alter table public.twingrid_sparks drop constraint if exists twingrid_sparks_check;
alter table public.twingrid_sparks add constraint twingrid_sparks_check check (
  (kind = 'visit'        and day is not null and from_account is null and reaction is null and note is null and transcript is null and rating is null and is_public = false) or
  (kind = 'reaction'     and reaction is not null and note is null and transcript is null and rating is null) or
  (kind = 'note'         and note is not null and reaction is null and transcript is null and rating is null) or
  (kind = 'conversation' and transcript is not null and is_public = false and reaction is null and note is null and rating is null) or
  (kind = 'rating'       and rating is not null and is_public = true and reaction is null and note is null and transcript is null and (from_account is not null or from_grid is not null)));

-- one rating per human per persona, one per visiting persona per persona (the Worker deletes the old one, then inserts)
create unique index if not exists twingrid_sparks_rating_human   on public.twingrid_sparks (grid_id, from_account) where kind = 'rating' and from_grid is null;
create unique index if not exists twingrid_sparks_rating_persona on public.twingrid_sparks (grid_id, from_grid)    where kind = 'rating' and from_grid is not null;

-- the public face, two columns added at the end (create or replace keeps the column order); grants restated per rule 1
create or replace view public.twingrid_sparks_public with (security_invoker = false, security_barrier = true) as
  select s.id, s.grid_id, s.from_account, s.kind, s.reaction, s.note, s.created_at, s.rating, s.from_grid
  from public.twingrid_sparks s
  join public.twingrid_grids_public g on g.id = s.grid_id
  where s.is_public and s.kind in ('reaction','note','rating')
    and (s.from_account is null or not exists (select 1 from public.twingrid_accounts a where a.id = s.from_account and a.is_suspended));
alter view public.twingrid_sparks_public owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_sparks_public from anon, authenticated, service_role, public;
grant select on public.twingrid_sparks_public to anon, authenticated;

-- the score: one row per lane, only for public personas, suspended raters excluded
create or replace function public.twingrid_spark_score(p_grid uuid)
returns table (lane text, avg_rating numeric, n integer)
language sql stable security definer
set search_path = ''
as $$
  select case when s.from_grid is null then 'human' else 'persona' end as lane,
         round(avg(s.rating)::numeric, 1) as avg_rating,
         count(*)::int as n
  from public.twingrid_sparks s
  where s.grid_id = p_grid and s.kind = 'rating' and s.is_public
    and exists (select 1 from public.twingrid_grids_public g where g.id = p_grid)
    and (s.from_account is null or not exists (select 1 from public.twingrid_accounts a where a.id = s.from_account and a.is_suspended))
  group by 1
$$;
revoke execute on function public.twingrid_spark_score(uuid) from public;
grant execute on function public.twingrid_spark_score(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 38. anon: select rating, from_grid from twingrid_sparks_public -> 0 rows, no error (columns exist); twingrid_spark_score(a public grid)
--     -> 0 rows; insert into twingrid_sparks (kind rating) -> 42501 (no grant)
-- 39. stranger (authenticated, foreign sub): insert rating -> 42501; update rating -> 42501; twingrid_spark_score -> 0 rows
-- 40. service role in a DO block, rolled back: rating 6 -> check violation; rating 3 by one account twice on one grid -> unique
--     violation; rating 3 human plus rating 5 from a persona (from_grid set) -> score human 3.0 n 1, persona 5.0 n 1; the view
--     shows both rows with rating set; kind rating with is_public false -> check violation
-- 41. HTTP with the publishable key: GET twingrid_sparks_public?select=rating,from_grid 200 [], POST rpc/twingrid_spark_score 200 [],
--     POST twingrid_sparks 401
