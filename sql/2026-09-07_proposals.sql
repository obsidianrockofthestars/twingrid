-- Personakind learning proposals (M8, 2026-09-07). PLAN.md section 3.6 and 5, M8.
--
-- The persona notices; the owner decides. After an owner asks "what did you learn" at the end of a chat (an explicit button,
-- 1 credit, announced), the Worker asks the model for at most one proposed cell change with a one-line reason and writes it
-- here as waiting. Nothing changes in the grid until the owner keeps it, and a kept proposal is applied by the page as a normal
-- grid save (the owner is the author of record). The Worker never writes the grid.
--
-- One phase (a new table), applied before the push as twingrid_proposals. Operators read, decide and delete their own rows;
-- only the Worker inserts (service key). Rules.learning = off refuses the ask in the Worker before any credit moves.

create table if not exists public.twingrid_proposals (
  id          bigint generated always as identity primary key,
  grid_id     uuid not null references public.twingrid_grids(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  facet       text not null check (char_length(facet) between 1 and 40),
  cell        text not null check (cell in ('CONTEXT','DO','DONT','GATES','VOICE')),
  source      text not null check (source in ('owner_chat','kindred_chat','world')),
  evidence    jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object' and octet_length(evidence::text) <= 4000),
  before_text text not null default '' check (char_length(before_text) <= 8000),
  after_text  text not null check (char_length(after_text) between 1 and 8000),
  reason      text not null default '' check (char_length(reason) <= 300),
  confidence  text not null default 'medium' check (confidence in ('low','medium','high')),
  status      text not null default 'waiting' check (status in ('waiting','kept','edited','removed')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
alter table public.twingrid_proposals enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.twingrid_proposals from anon, authenticated, service_role, public;
grant select, update, delete on public.twingrid_proposals to authenticated;
grant select, insert on public.twingrid_proposals to service_role;
drop policy if exists twingrid_proposals_select on public.twingrid_proposals;
create policy twingrid_proposals_select on public.twingrid_proposals for select using (public.twingrid_operates(owner));
drop policy if exists twingrid_proposals_update on public.twingrid_proposals;
create policy twingrid_proposals_update on public.twingrid_proposals for update using (public.twingrid_operates(owner)) with check (public.twingrid_operates(owner));
drop policy if exists twingrid_proposals_delete on public.twingrid_proposals;
create policy twingrid_proposals_delete on public.twingrid_proposals for delete using (public.twingrid_operates(owner));
create index if not exists twingrid_proposals_grid_idx on public.twingrid_proposals (grid_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 42. anon: select 0 rows, insert 42501. stranger: select 0, update 0 rows, delete 0 rows, insert 42501
-- 43. service role inserts a waiting row for a real grid; its operator reads it (1), marks it kept (1 row), deletes it (1 row); rolled back
-- 44. HTTP with the publishable key: GET twingrid_proposals 200 [], POST 401
