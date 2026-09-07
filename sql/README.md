# sql/, how a migration lands on the production database

There is no staging database. Every file here ran against project `jpepcqazscmhakxvutpg` through the Supabase connector as a tracked migration, and each file records what actually ran. Full rules in `CLAUDE.md` (Database rules) and `PLAN.md` section 8.

## Two phases, always

- **Phase A, additive** (functions, views, columns, tables): applied BEFORE the code that reads it is pushed. Nothing that exists today may change behaviour.
- **Phase B, lockdown** (policies, revokes, constraints that tighten): applied AFTER the push is proven live (live md5 equals disk, the page loads signed out).
- Both phases live in ONE migration file with the phases labelled, plus the probes and their expected results in the footer.

## Every new relation starts with the revoke

```sql
alter table public.<t> enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.<t> from anon, authenticated, service_role, public;
grant select on public.<t> to anon, authenticated;   -- or exactly what it needs, table level only
```

Supabase default privileges hand ALL to anon and authenticated on every new relation; `revoke ... from public` alone leaves them intact (2026-09-07: a new view took anonymous writes for two minutes).

## Before changing a policy or a grant, grep the policies

```sql
select polname, polrelid::regclass from pg_policy where pg_get_expr(polqual, polrelid) ilike '%<table>%';
```

A policy on another table may subquery the one you are locking; the policy is the gate, not the grant (2026-09-07: revoking anon SELECT on the grids table broke every read of accounts).

## Attack before the page reads it

Over HTTP with the publishable key, as anon and as a signed-in stranger (a throwaway account):

```
GET    /rest/v1/<relation>?select=*          expected: only what a stranger may see
PATCH  /rest/v1/<relation>?id=eq.<x>         expected: 401 42501
DELETE /rest/v1/<relation>?id=eq.<x>         expected: 401 42501
POST   /rest/v1/<relation>                   expected: 401 42501 (unless insert is the feature)
```

In SQL:

```sql
begin; set local role anon; select count(*) from public.<relation>; rollback;
begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
select count(*) from public.<relation>; rollback;
```

Write the probes and expected results into the migration file footer; paste the actual outputs into the PR. `attack.sql` is the running probe set.

## Other standing rules

- Table-level grants only. Never a column revoke against a table grant.
- Never revoke EXECUTE from anon on a function a SELECT policy calls.
- Anything that moves credits runs in a service-role-only function.
- A view that must show rows the caller cannot read on the base table is owned by `postgres` with `security_invoker = false` on purpose (the Lobby view). The advisor's `security_definer_view` finding on it is the design.
