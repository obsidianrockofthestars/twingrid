-- Personakind, delete my account (2026-09-14, Dylan: "delete accounts, all the stuff that is normal in any type of subscription
-- based service. Let's not hide it").
--
-- One phase, additive: two functions, service role only. Nothing the live page reads changes, so there is no phase B.
-- The Worker (POST /api/account/delete) resolves the caller from their own Supabase JWT through GoTrue and passes THAT id.
-- No id from a request body ever reaches these functions, so there is nothing to point at someone else's account.
--
-- Why a function and not the GoTrue admin API alone: the rows that do not cascade from auth.users (sparks this account left
-- on other pages, its credit ledger, agent keys and receipts, its daily media counters) and the auth user itself go in ONE
-- transaction. A refusal or a failure mutates nothing.
--
-- The shared project. jpepcqazscmhakxvutpg also serves the print portal (profiles, saved_designs, orders, admin_users), and
-- all of those hang off the same auth.users. handle_new_user() gives EVERY login a profiles row, so a profile alone is not a
-- print-portal customer; saved designs, orders or admin rights are. Such an account is REFUSED (shared_account) and routed
-- to support, because deleting the login would erase a customer's designs in another product. Founder ruling owed.
-- Also refused: an account that operates another account (the official account's operator), a moderator, and an
-- official account (the showcase personas live there; deleting it takes a founder, not a tap).
--
-- Media: storage.protect_delete() blocks deleting storage.objects in SQL, so the Worker deletes the files through the
-- Storage API FIRST, using the names the footprint returns (always under the caller's own uuid folder), then calls delete.

create or replace function public.twingrid_account_footprint(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'exists',       exists(select 1 from auth.users where id = p_uid),
    'personas',     (select count(*) from twingrid_grids where owner = p_uid),
    'published',    (select count(*) from twingrid_grids where owner = p_uid and is_public),
    'guestbook',    (select count(*) from twingrid_sparks where owner = p_uid and kind <> 'visit'),
    'sparks_given', (select count(*) from twingrid_sparks where from_account = p_uid),
    'kindred',      (select count(*) from twingrid_kindred where owner_a = p_uid or owner_b = p_uid),
    'places',       (select count(*) from twingrid_places where owner = p_uid),
    'media',        coalesce((select jsonb_agg(o.name order by o.name) from storage.objects o
                              where o.bucket_id = 'twingrid-media' and (storage.foldername(o.name))[1] = p_uid::text), '[]'::jsonb),
    'plan_active',  exists(select 1 from twingrid_credits where user_id = p_uid and period_end > now()),
    'other_app',    exists(select 1 from saved_designs where user_id = p_uid)
                    or exists(select 1 from orders where user_id = p_uid)
                    or exists(select 1 from admin_users where user_id = p_uid),
    'operates',     (select count(*) from twingrid_accounts where operated_by = p_uid and id <> p_uid),
    'moderator',    exists(select 1 from twingrid_moderators where user_id = p_uid),
    'official',     exists(select 1 from twingrid_accounts where id = p_uid and is_official)
  );
$$;

create or replace function public.twingrid_delete_account(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare fp jsonb;
begin
  fp := twingrid_account_footprint(p_uid);
  if p_uid is null or not (fp->>'exists')::boolean then raise exception 'no_such_account'; end if;
  if (fp->>'other_app')::boolean then raise exception 'shared_account'; end if;
  if (fp->>'operates')::int > 0 then raise exception 'operates_accounts'; end if;
  if (fp->>'moderator')::boolean then raise exception 'moderator_account'; end if;
  if (fp->>'official')::boolean then raise exception 'official_account'; end if;
  -- what does not cascade from auth.users: set null or no foreign key at all
  delete from twingrid_sparks where from_account = p_uid;
  delete from twingrid_sparks where from_grid in (select id from twingrid_grids where owner = p_uid);
  delete from twingrid_credit_events where user_id = p_uid;
  delete from twingrid_agent_writes where owner = p_uid;
  delete from twingrid_agent_tokens where owner = p_uid;
  delete from twingrid_media_daily where user_id = p_uid;
  -- the login and everything that cascades from it: accounts, grids, sparks received, kindred, circle, follows, blocks,
  -- likes, rules, actions, proposals, places, house guests, credits, profiles, identities, sessions.
  -- Reports this account filed keep the report with the reporter set null; reports ABOUT it keep their snapshot for moderation.
  delete from auth.users where id = p_uid;
  return fp - 'media';
end $$;

revoke all on function public.twingrid_account_footprint(uuid) from public, anon, authenticated;
revoke all on function public.twingrid_delete_account(uuid) from public, anon, authenticated;
grant execute on function public.twingrid_account_footprint(uuid) to service_role;
grant execute on function public.twingrid_delete_account(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Probes (expected in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 1. only service_role (and the owner) may execute either function. Expected: postgres and service_role only.
-- select p.proname, r.rolname from pg_proc p cross join pg_roles r
--  where p.proname in ('twingrid_account_footprint','twingrid_delete_account') and has_function_privilege(r.oid, p.oid, 'execute')
--  and r.rolname in ('anon','authenticated','service_role','postgres','public') order by 1,2;
-- 2. anon cannot call delete. Expected: ERROR 42501 permission denied for function twingrid_delete_account.
-- begin; set local role anon; select twingrid_delete_account('<any-uuid>'); rollback;
-- 3. a signed-in stranger cannot call delete, on another account or their own. Expected: ERROR 42501.
-- begin; set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub','<stranger>','role','authenticated')::text, true);
-- select twingrid_delete_account('<victim>'); rollback;
-- 4. over HTTP with the publishable key, as anon and as a signed-in stranger: POST /rest/v1/rpc/twingrid_delete_account. Expected: 401 or 403/42501.
-- 5. a shared print-portal account is refused and nothing moves. Expected: ERROR shared_account, row counts unchanged.
-- begin; select twingrid_delete_account('<account with saved_designs>'); rollback;
-- 6. the live delete of the throwaway, then as service role: every count in twingrid_account_footprint('<throwaway>') is 0,
--    exists is false, and a second account's footprint is byte-identical before and after.
