# CLAUDE.md, the twingrid repository (personakind.com)

Read this before any change. `PLAN.md` is the build plan; this file is the rulebook it runs under. Both are owned by Dylan Leeson (Potions and Familiars, LLC). Nothing here is a preference; every rule below was paid for by an incident or a ruling.

## What this is

Personakind, live at personakind.com. One static page (`docs/index.html`, an inline ES module) plus static HTML pages under `docs/`, one Cloudflare Worker (`worker/`: `index.js` router, `api.js` JSON API, `mcp.js` read-only MCP), Supabase Postgres with RLS (every table prefixed `twingrid_`, migrations under `sql/`), a Python engine (`engine/grid.py`, tests under `engine/tests`), templates under `docs/templates/`. Cloudflare deploys `main` automatically. There is no staging environment; the database is production.

## Working agreement

- **One builder at a time.** `git pull` first. Confirm with Dylan that no other tool (Cowork, Antigravity, another Claude Code) has the repo open. One milestone per branch, PR to `main`, Dylan merges and watches the deploy.
- **Do one milestone.** `PLAN.md` section 5 is the order. Do not start the next one. Do not touch billing (`handleRcWebhook`, packs, offerings, RevenueCat, Stripe) without a founder ruling; it is parked.
- **Prove from outside.** A change is done when the acceptance test in `PLAN.md` passes against the live site with `curl`, a fresh browser, or a probe with the publishable key, and the outputs are in the PR description. "It works" without output is not done.
- **Never commit, print or paste a secret.** Cloudflare secrets: dashboard or `wrangler secret put`. Supabase secret keys go on the `apikey` header only, never Bearer. The publishable key in the page is public by design. A secret that lands in a diff is burned: say so.
- **No em dashes or en dashes** anywhere: copy, comments, commit messages, PR text.

## Database rules (RLS before prod)

1. Every new table or view: `alter table ... enable row level security`, then
   `revoke insert, update, delete, truncate, references, trigger on <relation> from anon, authenticated, service_role, public;`
   then grant exactly what is needed. Supabase default privileges hand ALL to the API roles on every new relation; `revoke ... from public` alone leaves them intact. (2026-09-07: a new view took anonymous writes for two minutes because of this.)
2. Before changing a policy or a grant on a table, run
   `select polname, polrelid::regclass from pg_policy where pg_get_expr(polqual, polrelid) ilike '%<table>%';`
   and read every dependent policy. The policy is the gate, not the grant. (2026-09-07: revoking anon SELECT on the grids table broke every read of the accounts table, whose policy subqueries it.)
3. Two phases for anything that changes what the live page can read: phase A (additive: functions, views, columns) applied before the code push; phase B (lockdown: policies, revokes) applied after the push is proven live. Both in one migration file with the phases labelled.
4. Attack every new object before the page reads it: with the publishable key over HTTP as anon and as a signed-in stranger (a throwaway account), and in SQL with `set local role anon` / `set local role authenticated` plus `set_config('request.jwt.claims', ...)`. Write the probes and their expected results into the migration file's footer; paste the actual outputs into the PR.
5. Table-level grants only, never column-level against a table grant. Never revoke EXECUTE from anon on a function a SELECT policy calls. Anything that moves credits runs in a service-role-only function.
6. A view that must expose rows the caller cannot read on the base table is owned by `postgres` with `security_invoker = false` on purpose (the Lobby view `twingrid_grids_public` is one). The Supabase advisor flags it as `security_definer_view`; that is the design, and rule 1 makes it read-only.

## Page rules (`docs/index.html`)

1. Extract the inline `<script type="module">` and run `node --check` on it before and after the change.
2. Run `node tools/run_stub.mjs docs/index.html`; it must print `TOP-LEVEL OK`. `node --check` is syntax only: on 2026-09-03 a first-paint call placed above the `const` it read passed the check and blanked the live site for 21 minutes. A top-level call sits below every const it reads.
3. The module declares `let history`; browser history calls are `window.history`.
4. Every render of user text (handle, name, bio, cell, status, note, label) goes through `textContent`. Never `innerHTML` with user data. Images only as `<img src>` from our own bucket base through `avatarInto`. A theme is a preset key or a validated 6-digit hex. A room object is a catalog key from `docs/catalog/objects.json`, never a URL.
5. Public pages take the public palette (`body.marketing`, the third `:root` block: paper, ink, `--accent-w`); the editor takes the first `:root` (near-black, `--accent`). Persona pages read their eight `--p*` variables set inline by `pkApplyTheme`; nothing outside `#profile` and `#chat` may.
6. Measure every visual change at 1100x740 and 390 wide with `*{transition:none!important}` injected first, and record computed colours: 4.5 to 1 for text, 3 to 1 for non-text, against both dark and light owner bases. A reduced-motion path exists for anything animated.
7. Keep every new public surface reachable by keyboard with a visible focus ring, and give every new control a 24 px minimum target.

## Worker rules (`worker/`)

1. `node worker/api.test.mjs` after every change. When tests are added the pass count goes up, and new tests are mutation-checked: they must fail against the code before the change.
2. Every route that hands persona text to a model composes through `guardedPrompt` (the guard preamble) and, for anyone who does not operate the grid, from the Lobby projection (`fetchPublicGrid`) or the Kindred projection, never from the base table.
3. Third-party event names, status codes and fields are read off the vendor's live log or docs before code is written on them. RevenueCat has no REFUND event.
4. Never a stack trace in a response. JSON errors with short codes. CORS stays as `worker/index.js` sets it.
5. A cron tick is idempotent: a second run in the same period creates nothing, and every run writes its own receipt row.

## Product rules

- Vocabulary on screen is Jennifer's: Owner, Persona, Handbook, Home, Familiar, Circle, Kindred, Spark, Place, Life log, Trail. Scope keys in code stay `house`, `visiting`, `lobby`; the words on screen are Private, Kindred, Public.
- Every public persona surface carries the AI persona label. Every autonomous or scheduled post carries its authorship label (AUTOPILOT, OWNER, TOGETHER, SCHEDULED).
- Nothing runs on the founders' own model credits for a free user. Every credit spend is announced in the UI before it happens. The per-account cap and the monthly capacity gate stay in every new path.
- Publishing a persona requires the 18-plus confirmation. Private building is not gated.
- Private facets never reach a model in an autonomous run, a stranger's chat, a persona-to-persona exchange, or the connector.

## Local loop

`tools/check.sh` runs: module extract and `node --check`, `tools/run_stub.mjs`, `node worker/api.test.mjs`, `python -m pytest engine/tests -q`. It must exit 0 before a PR is opened. If it is missing, milestone M0 in `PLAN.md` creates it.

## When something breaks in production

Revert first (a `git revert` of the offending commit, pushed to `main`), prove the live md5 matches the reverted build, then write the post-mortem into the PR that fixes it: what happened, the minute it started and stopped, what caught it, and the rule that prevents it. A repeat failure with no new rule is the failure.
