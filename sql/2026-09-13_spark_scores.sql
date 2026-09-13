-- sql/2026-09-13_spark_scores.sql
-- Reviews in the open (v21, 2026-09-13). One read-only aggregate over public rating Sparks keyed by persona, so Explore reads every
-- card's score in one query and the Room's bar reads the same numbers as the page. Phase A only, additive. A view owned by postgres
-- with security_invoker off on purpose (rule 6): it joins the Lobby view, so a private persona has no row at all, and it excludes
-- suspended raters exactly as twingrid_spark_score() does. Rule 1: revoke everything, then grant select only.
-- Applied 2026-09-13 as twingrid_spark_scores. Probes in the footer; the outputs are in the PR.
create or replace view public.twingrid_spark_scores
with (security_invoker = false, security_barrier = true) as
  select s.grid_id,
         case when s.from_grid is null then 'human' else 'persona' end as lane,
         round(avg(s.rating)::numeric, 1) as avg_rating,
         count(*)::int as n
  from public.twingrid_sparks s
  join public.twingrid_grids_public g on g.id = s.grid_id
  where s.kind = 'rating' and s.is_public
    and (s.from_account is null or not exists (select 1 from public.twingrid_accounts a where a.id = s.from_account and a.is_suspended))
  group by s.grid_id, 2;
alter view public.twingrid_spark_scores owner to postgres;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_spark_scores from anon, authenticated, service_role, public;
grant select on public.twingrid_spark_scores to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 42. anon: select from twingrid_spark_scores -> only rows whose grid_id is in twingrid_grids_public; insert -> error (not insertable
--     or 42501); update -> error; delete -> error
-- 43. stranger (authenticated, foreign sub): the same rows as anon, never a row for a private persona; every write -> error
-- 44. service role in a DO block, rolled back: one human rating 4 on a public grid -> one row (human, 4.0, 1) and
--     twingrid_spark_score() for that grid returns the same lane, avg_rating and n; the same rating on a PRIVATE grid -> no row;
--     a rating from a suspended account -> excluded from both; a persona-lane rating (from_grid set) -> a second row, lane persona
-- 45. HTTP with the publishable key: GET twingrid_spark_scores?select=* 200 (an array), POST twingrid_spark_scores 401 or 405,
--     PATCH 401 or 405
