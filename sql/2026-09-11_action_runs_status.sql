-- Personakind autopilot receipt status (2026-09-11): tell a dropped cron tick from a crashed one.
--
-- v18 review finding 2: the receipt was one best-effort POST at the end of the tick, so a dropped Cloudflare
-- invocation (no row at all) and a completed tick whose receipt POST failed were indistinguishable, defeating the
-- invariant the receipts exist for (worker/api.js: "a quiet hour and a dropped run look different"). twingrid_action_runs
-- was missing rows for 09-10 15:00 and 16:00 UTC and 09-11 12:00, 13:00 and 15:00 UTC with no way to tell which gap was which.
--
-- The Worker now writes a 'started' row at the top of the tick and PATCHes it to 'finished' at the end (or 'crashed'
-- if the tick throws). A row stuck at 'started' flags a crash; no row at all flags a dropped invocation. GET
-- /api/autopilot/health reports both over the last 24 hours.
--
-- One phase, additive only: a new column and one grant. Nothing the live page reads changes, so this applies before
-- the Worker push. The table is service-role only (2026-09-07_autonomy.sql); anon and authenticated cannot read it.

-- Existing rows were all written at a tick's exit point (the old code only ever posted on completion), so they are
-- 'finished'. New inserts set status explicitly; the default only backfills history.
alter table public.twingrid_action_runs
  add column if not exists status text not null default 'finished'
  check (status in ('started','finished','crashed'));

-- The tick now UPDATEs its own started row to finished or crashed. service_role had select and insert only.
grant update on public.twingrid_action_runs to service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 1. the column exists with the check and default. Expected: status, text, 'finished'::text, one row.
-- select column_name, data_type, column_default from information_schema.columns where table_name = 'twingrid_action_runs' and column_name = 'status';
--
-- 2. existing receipts backfilled to finished. Expected: every row 'finished', zero nulls.
-- select status, count(*) from public.twingrid_action_runs group by status;
--
-- 3. the check rejects a bad value. Expected: ERROR new row violates check constraint.
-- begin; insert into public.twingrid_action_runs (status) values ('bogus'); rollback;
--
-- 4. anon and authenticated still cannot read the table. Expected: ERROR 42501 permission denied (both).
-- begin; set local role anon; select count(*) from public.twingrid_action_runs; rollback;
-- begin; set local role authenticated; select count(*) from public.twingrid_action_runs; rollback;
--
-- 5. anon and authenticated cannot update it (no grant). Expected: ERROR 42501 permission denied (both).
-- begin; set local role anon; update public.twingrid_action_runs set status = 'crashed'; rollback;
-- begin; set local role authenticated; update public.twingrid_action_runs set status = 'crashed'; rollback;
