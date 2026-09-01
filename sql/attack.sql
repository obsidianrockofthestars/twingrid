-- Personakind credits: privilege probes.
-- Run AFTER 2026-09-01_credits.sql, in the Supabase SQL editor.
-- Each block sets the role the way PostgREST does, tries the thing, and the
-- comment says what MUST happen. If any probe succeeds where it should be
-- denied, stop and fix before deploying the Worker.
--
-- Run each block separately (the SQL editor runs as postgres; the SET ROLE
-- lines switch to the API roles the same way PostgREST does).

-- ---------------------------------------------------------------------------
-- Probe 1: anon reads twingrid_credits
-- Expected: ERROR permission denied for table twingrid_credits
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select * from public.twingrid_credits limit 1;
rollback;

-- ---------------------------------------------------------------------------
-- Probe 2: anon reads the ledger
-- Expected: ERROR permission denied for table twingrid_credit_events
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select * from public.twingrid_credit_events limit 1;
rollback;

-- ---------------------------------------------------------------------------
-- Probe 3: anon calls twingrid_use_credit
-- Expected: ERROR permission denied for function twingrid_use_credit
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select public.twingrid_use_credit('00000000-0000-0000-0000-000000000000');
rollback;

-- ---------------------------------------------------------------------------
-- Probe 4: anon calls twingrid_grant_credits
-- Expected: ERROR permission denied for function twingrid_grant_credits
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select public.twingrid_grant_credits('00000000-0000-0000-0000-000000000000', 500, 'grant', 'attack-anon', null);
rollback;

-- ---------------------------------------------------------------------------
-- Probe 5: authenticated inserts a balance for itself
-- Expected: ERROR permission denied for table twingrid_credits
--           (table level GRANT is SELECT only; RLS has no insert policy either)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
insert into public.twingrid_credits (user_id, balance) values ('00000000-0000-0000-0000-000000000000', 999999);
rollback;

-- ---------------------------------------------------------------------------
-- Probe 6: authenticated updates its own balance
-- Expected: ERROR permission denied for table twingrid_credits
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
update public.twingrid_credits set balance = 999999 where user_id = '00000000-0000-0000-0000-000000000000';
rollback;

-- ---------------------------------------------------------------------------
-- Probe 7: authenticated inserts a ledger row (fake purchase)
-- Expected: ERROR permission denied for table twingrid_credit_events
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
insert into public.twingrid_credit_events (user_id, delta, kind, ref) values ('00000000-0000-0000-0000-000000000000', 500, 'purchase', 'attack-auth');
rollback;

-- ---------------------------------------------------------------------------
-- Probe 8: authenticated calls the grant function directly
-- Expected: ERROR permission denied for function twingrid_grant_credits
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
select public.twingrid_grant_credits('00000000-0000-0000-0000-000000000000', 500, 'grant', 'attack-auth-fn', null);
rollback;

-- ---------------------------------------------------------------------------
-- Probe 9: authenticated reads someone ELSE's balance
-- Expected: 0 rows (SELECT is granted, RLS hides other users' rows). No error.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select count(*) as should_be_zero from public.twingrid_credits where user_id <> '11111111-1111-1111-1111-111111111111';
rollback;

-- ---------------------------------------------------------------------------
-- Probe 10: service role can do the real work (positive control)
-- Expected: first call returns 5, second returns 5 (same ref, idempotent),
--           use_credit returns 4, then the rollback discards it all.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
select public.twingrid_grant_credits('00000000-0000-0000-0000-000000000000', 5, 'grant', 'probe-10', now() + interval '1 day') as first_call;
select public.twingrid_grant_credits('00000000-0000-0000-0000-000000000000', 5, 'grant', 'probe-10', now() + interval '1 day') as second_call_same_ref;
select public.twingrid_use_credit('00000000-0000-0000-0000-000000000000') as after_one_use;
rollback;
-- Note: probe 10 needs a real auth.users row for that uuid because of the
-- foreign key. Substitute your own user id, or expect a FK error, which is
-- also a correct outcome (nothing was written).
