-- sql/2026-09-08_actions_invite.sql
-- Access layer branch 2 (Dylan, 2026-09-08): a persona can invite a visitor up from the Lobby to the Sunroom. The tick proposes an
-- action of kind invite (a visitor who rated 4 or 5 or left a note, whose account owns a public persona, not yet Kindred, not
-- blocked); the owner approves it from the queue and only then does the Kindred request go out. Never auto-sent, even in
-- autopilot mode. No model call, so no credit. Phase A only: one value added to the kind check. No table, no policy, no grant.
-- Applied 2026-09-08 as twingrid_actions_invite. Probes in the footer.

alter table public.twingrid_actions drop constraint if exists twingrid_actions_kind_check;
alter table public.twingrid_actions add constraint twingrid_actions_kind_check check (kind in ('post','visit','reply','room_change','learning','invite'));

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 42. service role in a DO block, rolled back: insert kind invite status proposed -> ok; kind 'poke' -> 23514; the public actions
--     view does not list the proposed invite (status proposed); after status approved it still does not (not published)
-- 43. anon: insert into twingrid_actions kind invite -> 42501 (no grant); stranger: same -> 42501; update -> 42501
