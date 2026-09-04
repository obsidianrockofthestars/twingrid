-- 2026-09-04 grid suspension (OWASP review F1, Dylan's ruling the same day).
-- Before this a report carried a grid_id but the only per-item takedown targeted the
-- empty twingrid_personas table, and suspending an account left its public grids live in
-- Explore, chat and the MCP server because the grids SELECT policy had no suspension clause.
-- Everything public reads through this one policy (page, Worker chat and media, MCP), so
-- one clause covers all three. RLS re-attacked anon and authenticated before this shipped.

alter table public.twingrid_grids add column if not exists is_suspended boolean not null default false;

-- SECURITY DEFINER helper so the grids policy can read accounts without recursing into
-- the accounts policy (which itself reads grids).
create or replace function public.twingrid_owner_suspended(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select a.is_suspended from public.twingrid_accounts a where a.id = p_owner), false);
$$;
revoke all on function public.twingrid_owner_suspended(uuid) from public;
grant execute on function public.twingrid_owner_suspended(uuid) to anon, authenticated;

drop policy if exists twingrid_select on public.twingrid_grids;
create policy twingrid_select on public.twingrid_grids for select using (
  public.twingrid_operates(owner)
  or (is_public = true and is_suspended = false and not public.twingrid_owner_suspended(owner))
);

-- The moderator takedown now targets the grid (persona = grid, ruled 2026-08-29).
create or replace function public.twingrid_mod_suspend(p_kind text, p_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.twingrid_is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_kind = 'account' then
    update public.twingrid_accounts set is_suspended = p_suspended where id = p_id;
  elsif p_kind = 'grid' then
    update public.twingrid_grids set is_suspended = p_suspended where id = p_id;
  elsif p_kind = 'persona' then
    update public.twingrid_personas set is_suspended = p_suspended where id = p_id;
  else
    raise exception 'kind must be account, grid or persona';
  end if;
  if not found then raise exception 'no such %', p_kind; end if;
end $$;

-- The mod view's suspended flag now reads the grid first, then the account.
create or replace function public.twingrid_mod_reports(p_status text default 'open')
returns table(id uuid, created_at timestamptz, status text, reason text, note text, target_kind text, target_label text, target_owner uuid, persona_id uuid, grid_id uuid, target_handle text, target_suspended boolean)
language sql security definer set search_path = '' as $$
  select r.id, r.created_at, r.status, r.reason, r.note, r.target_kind, r.target_label, r.target_owner,
         r.persona_id, r.grid_id, a.handle,
         coalesce((select g.is_suspended from public.twingrid_grids g where g.id = r.grid_id),
                  (select p.is_suspended from public.twingrid_personas p where p.id = r.persona_id),
                  a.is_suspended, false)
  from public.twingrid_reports r
  left join public.twingrid_accounts a on a.id = r.target_owner
  where public.twingrid_is_moderator() and (p_status is null or r.status = p_status)
  order by r.created_at asc;
$$;

-- Default-privilege leftovers found in the same review: anon and authenticated held
-- TRUNCATE, REFERENCES and TRIGGER on every twingrid table (RLS does not govern TRUNCATE).
-- Table-level revokes, never column-level against a table grant.
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_name like 'twingrid\_%' escape '\' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t);
  end loop;
end $$;
