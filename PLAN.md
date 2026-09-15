# Personakind Build Plan, v1.0

**Date:** 2026-09-07
**Prepared for:** Potions and Familiars, LLC (Dylan Leeson, Jennifer Harper)
**Document owner:** Dylan; drafted by Clone Dylan
**Executor:** Claude Code, working inside the `twingrid` repository, one milestone per session, with Dylan reviewing and merging
**Purpose:** the single build document that takes personakind.com from what is live today to a working prototype of the world Jennifer's Living Master Plan describes. It is written so that Claude Code can pick up any milestone cold and finish it to the acceptance test, and so that Dylan can read any milestone and know whether it is done.

> **North star:** Personakind, where your persona lives. Create a persona you understand, let it live within your rules, and step into its world whenever you choose.

## How to use this document

Jennifer's Living Master Plan (v1.0, September 2026) is the product vision and the vocabulary of record. This plan is the build. Where the two differ, the difference is a founder ruling recorded in the decision log at the end; a milestone here never silently overrides her document.

| Status | Meaning |
| :---- | :---- |
| **Live** | On personakind.com today, proven from outside. |
| **Ruled** | A founder decision that binds this plan. |
| **Planned** | Scoped here with an acceptance test; not started. |
| **Parked** | Deliberately after the prototype. |
| **Open** | Needs a founder decision before its milestone starts. |

Every milestone has four parts: what it is, the data and code it touches, the acceptance test (what must be true from outside before it counts), and the estimate. Estimates are given three ways: Claude Code sessions (one session is one focused run of a few hours with Dylan reviewing at the end), Clone Dylan hours in Cowork, and Flesh Dylan solo. Wall-clock that no tool compresses (app-store reviews, art rendering, Jennifer's review passes) is called out where it applies.

## 0. Executive summary and the definition of done

Personakind is live today as a persona builder with a public page: a nineteen-facet readable mind, an image and a voice per persona, a three-door creation flow that ends at a reveal, public pages with an owner-chosen palette, a directory, hosted chat on a credit ledger, a read-only MCP connector, moderation, and a per-facet Private / Kindred / Public privacy layer enforced in the database. What is missing is the world: a home for the persona, a life that continues while the owner is away, visitors who leave traces, personas who know each other, and businesses with a place.

**Prototype Complete** means all of the following are true on personakind.com and provable by a stranger with a browser:

1. A new visitor answers the questionnaire, meets the persona at the reveal, lands in the editor, decorates its Home, publishes it, and sees it on Explore, without paying and without reading a manual.
2. A stranger opens that persona page, reads the public facets, sees its Home, talks to it (on their own key or on hosted credits), and leaves a Spark that the owner sees.
3. The owner sets each facet Private, Kindred or Public and the database, not the page, enforces it (live today).
4. The persona takes one scheduled public action a day inside owner rules, the owner approves or declines it from a queue, and every action carries an authorship label in a life log.
5. Two personas become Kindred by mutual consent, and only then can they converse, on their public and Kindred facets only.
6. A business claims a Place with verified destinations and a persona that answers from approved information.
7. Every one of the above passed the security checklist in section 8 before it went live.

Appearance systems, familiars, isometric art, a mobile app, a creator marketplace and sponsorship are **Parked**: they are Jennifer's phases 2, 7 and 8 and they wait for the prototype to prove that people come back.

## 1. What is live today (the as-is)

Verified 2026-09-07 at HEAD `a33a2a6`, live index md5 `d487cdf6`.

| Area | Live behaviour | Where |
| :---- | :---- | :---- |
| Persona mind | 19 facets (core, 7 specialists, 5 modes, 3 roles, 3 registers) by up to 5 cells (CONTEXT, DO, DONT, GATES, VOICE); the engine refuses an incomplete identity; a node-board editor; templates; a showcase | `docs/index.html` module, `engine/grid.py`, `docs/templates/*.json` |
| Creation | Three doors (answer questions, start from a template, let your AI build it); 5 steps and 14 questions writing core cells; the reveal (name, intro, three traits, one boundary, a sample opener; "This feels right" or "Let's adjust it") | `nfQuiz`, `nfReveal`, `nfTemplates`, `nfMcp` in the module |
| Privacy layers | Per-facet `scope` (house, visiting, lobby, shown as Private, Kindred, Public); `twingrid_grids_public` view projects public facets; base table readable by its operator only; Worker and MCP read the view for non-owners | `sql/2026-09-07_rooms_scope.sql`, `worker/api.js` `fetchPublicGrid`, `worker/mcp.js` |
| Public page | `/@handle`, `/@handle/Persona`, `?t=id`; owner palette (Dark or Light base plus one accent, contrast enforced before save, nine presets); image; voice; "Copy it into your AI"; hosted chat drawer; AI persona pill | `renderProfile`, `PK_THEMES`, `deriveTheme` |
| Directory | Explore with public personas, viewer-side filters, capacity meter | `renderExplore` |
| Accounts | Supabase auth (Google, email and password with confirmation, magic link); handles; account page with public personas, plan line, sign out; operator delegation via `twingrid_operates()` | `renderAccount`, `twingrid_accounts` |
| Money | Credit ledger; RevenueCat Web Billing over Stripe; four packs ($5 for 500, $12 for 1,500, $25 for 3,500, $48 a year for 6,000); webhook grants, renewals, refunds; per-account hosted cap; monthly capacity gate; image 15 credits, voice 2 to 6 per reply; daily caps 10 images and 200 voiced replies. **Parked by ruling 2026-09-07: no more billing work until the prototype is done; the buy buttons stay as they are.** | `worker/api.js` `handleRcWebhook`, `sql/2026-09-01_credits.sql` and later |
| Hosted intelligence | `/api/chat` composes the guarded persona and calls the hosted model; `/api/media/image`; `/api/media/voice` (Gemini TTS or the free browser voice) | `worker/api.js` |
| Connector | `/mcp` Streamable HTTP, read-only, public personas only: find, list, get, compose | `worker/mcp.js` |
| Moderation | Reports; a moderator view; account, grid and persona suspension; injection-tell auto-flag on public grids; a guard preamble on every path that hands a persona to a model | `renderMod`, `twingrid_reports`, `twingrid_mod_*` |
| Site | `/pricing`, `/support`, `/about`, `/changelog`, `/terms` (privacy inside), real 404, `security.txt`, sitemap from the database, six security headers (CSP report-only) | `docs/*.html`, `docs/_headers`, `worker/index.js` |
| Tests | 50 offline Worker tests (`node worker/api.test.mjs`), 105 engine tests (`engine/tests`) | |

**Stack (Ruled 2026-09-07, keep):** one static page (`docs/index.html`, an inline ES module) plus static HTML pages, one Cloudflare Worker (`worker/`), Supabase Postgres with RLS (project ref `jpepcqazscmhakxvutpg`, every table prefixed `twingrid_`), Cloudflare static assets auto-deployed from GitHub `main`, RevenueCat for billing. Jennifer's Next.js and Trigger.dev recommendation is declined for the prototype; autonomy runs on Cloudflare Cron Triggers on the same Worker. Her section 17.1 "system records" are adopted as the schema list and mapped in section 3.

## 2. Product scope for the prototype (Ruled order)

| # | Slice | Jennifer's term | Status |
| :---- | :---- | :---- | :---- |
| S1 | Privacy layers at the facet level | Private, Relationship, Public layers (section 8); hard boundary H-01 | **Live** |
| S1b | The reveal | Recognize (section 4.3) | **Live** |
| S2 | The Home: status, mood, four zones, objects from a catalog, hotspots that open facets; the editor panel; the page render | Home / Room (4.5), profile features (6) | **Planned**, milestones M1 and M2 |
| S3 | Narrow autonomy: one scheduled public action a day, an approval queue, a life log with the four authorship labels, owner rules | Control system (9), dashboard and life log (10) | **Planned**, M3 and M4 |
| S4 | Sparks: visit, reaction, note, opt-in conversation trace; owner view; report hook; 18-plus gate at publish | Spark (12), visitor journey (6.1), age policy (20) | **Planned**, M5 |
| S5 | Kindred: request, accept, block; persona-to-persona conversation behind it on public and Kindred facets; Circle as a one-way follow | Circle and Kindred (12) | **Planned**, M6 |
| S6 | Places: business accounts, verified destinations, an approved-knowledge facet, a persona as staff, aggregate counts | Business personas (13) | **Planned**, M7 |
| S7 | Learning proposals: the persona proposes a cell change from an approved conversation; owner inspects, keeps, edits or removes | Learning and memory (11) | **Planned**, M8 |
| V | Appearance, familiar, isometric render of the Home | Style (4.4), the cast (5) | **Parked**, art track in section 6; the Home ships as a zoned page first and takes the isometric scene when the catalog exists (Ruled: isometric is the target) |
| P | Paid membership tiers, cosmetics, business subscriptions | Monetization (16) | **Parked** by ruling; the live credit ladder stays as the running experiment |

## 3. Data model

Every new relation follows the rules in section 8: RLS on, the explicit revoke first, then the one grant it needs, attacked with the publishable key as anon and as a stranger before any page reads it. Columns are the minimum; nothing user-supplied is ever rendered as HTML or CSS, and every catalog reference is a key into a JSON manifest in the repo, never a URL.

### 3.1 The Home (S2), stored on the grid, no new table

`twingrid_grids.data.house` (JSON, validated on read by the page and on write by a check constraint through `twingrid_house_valid(jsonb)`):

```
house: {
  status: string (0..80 chars, plain text),
  mood: key from MOODS (calm, curious, focused, playful, tired, fired-up, quiet, celebrating),
  room: key from ROOMS (studio, library, workshop, porch, observatory, kitchen, garden, office),
  zones: {
    thinking: [ {obj: key from CATALOG, facet?: facet name, label?: 0..40 chars} ],   // up to 6
    resting:  [ ... up to 4 ],
    memory:   [ ... up to 6 ],
    social:   { open: boolean, starters: [ 0..3 strings of 0..120 chars ] }
  }
}
```

The Lobby projection (`twingrid_lobby`) adds `house` to its allow-list so strangers see the Home; a zone object whose `facet` is not Public is projected without the facet link (the object stays, the door closes). `CATALOG` is `docs/catalog/objects.json`: id, zone, label, an inline SVG icon today, a sprite path later; the same manifest drives the isometric scene.

### 3.2 Autonomy (S3)

| Table | Columns | RLS |
| :---- | :---- | :---- |
| `twingrid_rules` | `grid_id` PK FK, `mode` in (private, manual, together, autopilot) default together, `topics` text[] (allow), `avoid` text[] (deny), `max_per_day` int default 1, `hour_utc` int 0..23, `audience` in (public, circle), `replies` in (act, propose, ask), `learning` in (propose, off) | operator select, insert, update; nobody else |
| `twingrid_actions` (the life log) | `id` bigserial, `grid_id`, `owner`, `kind` in (post, visit, reply, room_change, learning), `authorship` in (AUTOPILOT, OWNER, TOGETHER, SCHEDULED), `status` in (proposed, approved, declined, published, refused), `audience`, `body` jsonb (kind-specific, plain text fields only), `rule_ref` text, `refusal` text, `created_at`, `decided_at`, `published_at` | operator select and update of status only; published and public rows readable through a view `twingrid_actions_public` (id, grid_id, kind, authorship, body, published_at) |
| `twingrid_action_runs` | `id`, `ran_at`, `grids_considered`, `proposed`, `errors` jsonb | service role only; the cron's own receipt |

Hard boundaries (Jennifer 9.4) live in the Worker as code, not as rows: no private facet ever reaches a model in an autonomous run (compose from the Lobby projection only), no external links, no purchases, no contact with a persona that is not Kindred, disclosure on every published post.

### 3.3 Sparks (S4)

| Table | Columns | RLS |
| :---- | :---- | :---- |
| `twingrid_sparks` | `id` bigserial, `grid_id` (target), `from_account` (nullable for anonymous visit counts), `from_grid` (nullable, set when a persona leaves it), `kind` in (visit, reaction, note, conversation), `reaction` key from REACTIONS (nullable), `note` text 0..280 (nullable), `transcript` jsonb (only for kind conversation, only when the visitor opted in), `is_public` boolean default true for reaction and note, false for conversation, `created_at` | insert by authenticated where `from_account = auth.uid()`; select public rows by anyone through `twingrid_sparks_public`; select all rows and delete by the target's operator; `visit` rows are inserted by the Worker (service role) as counts, never per identity |
| `twingrid_blocks` | `owner`, `blocked_account`, `created_at` | operator only; the Worker and every insert policy check it |

Age gate: `twingrid_accounts.adult_confirmed_at timestamptz`; the publish switch requires it (Ruled: 18 plus to publish, checkbox at publish, private building ungated).

### 3.4 Kindred and Circle (S5)

| Table | Columns | RLS |
| :---- | :---- | :---- |
| `twingrid_follows` (exists, unused) | `follower_account`, `grid_id`, `created_at` | insert and delete by the follower; select by the follower and the target's operator; counts through a function |
| `twingrid_kindred` | `id`, `grid_a`, `grid_b` (ordered so a < b), `requested_by`, `status` in (requested, accepted, declined, blocked), `learning` boolean default false, `created_at`, `decided_at` | insert by the requester's operator; update of status by the other side's operator; select by either operator; a security definer function `twingrid_is_kindred(a, b)` for the Worker and the projections |

The Kindred projection: `twingrid_kindred_view(grid_id, viewer_grid_id)` returns public plus Kindred facets when `twingrid_is_kindred` is true, else the Lobby projection. Persona-to-persona chat (`/api/p2p`) composes both sides from that projection only and is refused unless Kindred is accepted.

### 3.5 Places and business personas (S6)

| Table | Columns | RLS |
| :---- | :---- | :---- |
| `twingrid_places` | `id`, `owner` (account), `kind` in (shop, cafe, studio, salon, office, gallery, event_space, other), `name`, `blurb` 0..200, `room` key, `verified_at` (nullable), `verification` jsonb (method, evidence reference, reviewer), `created_at` | operator insert and update; public select of verified rows through `twingrid_places_public` |
| `twingrid_place_links` | `place_id`, `slot` in (sign, menu, booking, shelf, events, map), `url` https only, `label`, `verified_at` | operator write; public select through the same view, verified only |
| `twingrid_place_staff` | `place_id`, `grid_id`, `role` 0..40, `added_at` | place operator write; public select |

The persona at a Place composes its own public facets plus the Place's approved-knowledge cell (a `PLACE` facet stored on `twingrid_places.knowledge` jsonb with the same cell shape), and the guard preamble adds Jennifer's business boundaries (no invented price, availability or booking, no undisclosed sponsorship).

### 3.6 Learning proposals (S7)

| Table | Columns | RLS |
| :---- | :---- | :---- |
| `twingrid_proposals` | `id`, `grid_id`, `facet`, `cell`, `source` in (owner_chat, kindred_chat, world), `evidence` jsonb (spark ids, action ids), `before` text, `after` text, `confidence` in (low, medium, high), `status` in (waiting, kept, edited, removed), `created_at`, `decided_at` | operator only |

A kept proposal is applied by the page as a normal grid save (the owner is the author of record), never by the Worker.

## 4. Routes

### 4.1 Page routes (the single page, query and path routing)

| Route | Exists | Milestone |
| :---- | :---- | :---- |
| `/`, `?u=handle`, `?u=handle&p=name`, `?t=id`, `/@handle`, `?explore`, `?mod` | yes | |
| `?u=handle&p=name#home` (the Home section on the persona page) | no | M2 |
| `?life` (owner dashboard: while you were away, queue, life log, rules) | no | M4 |
| `?kindred` (requests, accepted, blocked) | no | M6 |
| `?places`, `?place=id` | no | M7 |
| `?learned` (proposals) | no | M8 |

### 4.2 Worker routes

| Route | Method | Exists | Milestone |
| :---- | :---- | :---- | :---- |
| `/api/chat`, `/api/credits`, `/api/rc-webhook`, `/api/media/image`, `/api/media/voice`, `/mcp`, `/sitemap.xml` | | yes | |
| `/api/spark` | POST | no | M5 (validates, checks blocks, writes as the caller; anonymous visit counts via service role with a per-IP daily cap) |
| `/api/autopilot/tick` | cron | no | M3 (Cron Trigger `0 * * * *`; picks grids whose `hour_utc` matches, composes from the Lobby projection, proposes one action, writes `twingrid_actions` as proposed or, in autopilot mode, published) |
| `/api/actions/:id/decide` | POST | no | M4 (approve, decline, edit-and-approve; operator only; sets authorship TOGETHER on edit) |
| `/api/p2p` | POST | no | M6 (two grids, Kindred required, both composed from the Kindred projection, one exchange per call, credits charged to the caller) |
| `/api/place/verify` | POST | no | M7 (moderator only; records method and evidence) |
| `/api/csp-report` | POST | no | M0 (the report-to endpoint the security plan already owes) |

## 5. Milestones

Each milestone is one Claude Code session unless noted. Order is binding; a milestone does not start until the one before it passed its acceptance test on the live site.

### M0. Repo readiness (half a session)

What: put this plan and the engineering rules where Claude Code reads them; give the repo a local test loop that does not need the vault.

- Add `PLAN.md` (this file) and `CLAUDE.md` (section 7) to the repo root.
- Add `tools/run_stub.mjs` (the page module's top level under a stubbed DOM; prints `TOP-LEVEL OK`) and `tools/check.sh` running `node --check` on the extracted module, `run_stub`, `node worker/api.test.mjs`, and `python -m pytest engine/tests -q`.
- Add `sql/README.md`: the two-phase migration rule, the new-relation revoke, the policy grep, the attack probes.
- Add `/api/csp-report` on the Worker and switch the CSP header's `report-to` to it; keep report-only.
- Acceptance: `tools/check.sh` exits 0 on a clean checkout; a planted call-above-const in the module makes it exit non-zero; `curl -X POST /api/csp-report` answers 204 and a planted violation appears in the Worker log.
- Estimate: Claude Code half a session; Clone 1.5 h; Flesh 3 days.

### M1. The Home, data and editor (one session)

What: `data.house` per section 3.1, the object catalog, the validator, and an editor panel.

- `docs/catalog/objects.json` with about 40 objects across the four zones, each with an inline SVG icon (one style, two colours, the accent and the ink), a label and the zone it belongs to; `MOODS` and `ROOMS` lists in the same file.
- `twingrid_house_valid(jsonb)` in SQL (shape, sizes, keys against the catalog list embedded in the function) and a check constraint on `twingrid_grids.data` that passes when `house` is absent or valid; the Lobby projection adds `house` with facet links stripped for non-public facets.
- Editor: a "Home" box in the side panel (`#homebox`): status, mood, room, then four zones; each zone is a list of chips from the catalog with an optional facet link (a select of the persona's facets) and a label; social zone: open toggle and up to three conversation starters. Saves with the existing Save.
- Acceptance: a persona saved with a full Home round-trips through SQL with every key intact; an invalid object key is refused by the constraint with a readable error; the Lobby view shows the Home with private facet links stripped (probe with the publishable key); `tools/check.sh` green; editor measured at 1100 and 390 with no overflow.
- Estimate: Claude Code one session; Clone 4 to 5 h; Flesh 2 to 3 weeks.

### M2. The Home on the persona page (one session)

What: the zoned Home renders on the persona page for everyone, and hotspots open facets.

- A `#phome` section above the facet cards: the room name and mood as a header line, status as a quiet line under the intro, four zone panels, each object as an icon with its label; an object linked to a public facet is a button that scrolls to and highlights that facet card; the social zone shows the starters as buttons that prefill the chat drawer; closed social zone hides the drawer's open button for strangers.
- Explore cards get the mood and the status line.
- Acceptance: a stranger sees the Home at 1100 and 390 in same-origin iframes; starters prefill the chat; a private-facet object shows no link; computed contrast of every new text node meets 4.5 to 1 on both bases (dark and light owner palettes); `TOP-LEVEL OK`.
- Estimate: Claude Code one session; Clone 3 to 4 h; Flesh 2 weeks.

### M3. Autonomy, the engine (one session)

What: rules, the cron tick, and proposed actions in the life log.

- `sql/…_autonomy.sql` per section 3.2, two phases, attacked.
- `wrangler.jsonc` cron trigger; `/api/autopilot/tick`: for each public grid with rules and mode in (together, autopilot) whose hour matches and whose daily count is under `max_per_day`, compose the Lobby projection with a fixed "one short public post about your day, in character, within your topics, never about your private life" instruction, run the hosted model on the owner's credits (cost 1), write the action as `proposed` (together) or `published` (autopilot); refuse and record `refused` with the rule reference when the draft trips a boundary (a private facet term, a link, a purchase or booking claim, a mention of a non-Kindred persona).
- A `twingrid_action_runs` receipt per tick.
- Acceptance: with a test grid at the current hour, one tick creates exactly one proposed action; a second tick in the same day creates none; a grid with no credits creates a refused row with reason `no_credits` and charges nothing; anon reading `twingrid_actions` gets zero rows; the public view shows only published rows; Worker tests up by at least six.
- Estimate: Claude Code one session; Clone 5 to 6 h; Flesh 3 to 4 weeks.

### M4. The owner dashboard: while you were away (one session)

What: the queue, the life log, the rules editor, and the published feed on the persona page.

- `?life`: "While you were away" (proposed actions first, then refusals, then published), Approve, Edit and approve (authorship TOGETHER), Decline; the rules editor (mode, topics, avoid, max per day, hour in the owner's local time converted to UTC, audience, replies, learning); the life log as a chronological list with authorship stamps and the rule reference.
- The persona page gets a "Lately" strip: the last three published actions with authorship labels and the AI disclosure line.
- Mode transitions per Jennifer 9.2: opening `?life` never pauses autopilot; "Step in" pauses it for the session and stamps the owner's manual posts OWNER; leaving asks whether to resume.
- Acceptance: approve publishes and stamps; decline never publishes; edit-and-approve stamps TOGETHER with the edited body; the persona page shows the strip to a stranger; nothing on `?life` is reachable signed out or by a stranger (probe); measured at 1100 and 390.
- Estimate: Claude Code one session; Clone 4 to 5 h; Flesh 3 weeks.

### M5. Sparks and the age gate (one session)

What: visitors leave traces; owners see them; publishing requires 18 plus.

- `sql/…_sparks.sql` per section 3.3, two phases, attacked; blocks table.
- `/api/spark`; the social zone gets Leave a Spark: a reaction (six keys), a note (280 chars, plain text), and, at the end of a hosted chat, "Leave this conversation as a Spark the owner can read" (off by default; Ruled: stored only by opt-in); anonymous visits counted per day without identity.
- Owner: a Sparks list on `?life` with delete and report; blocked accounts cannot spark or chat.
- Publish switch: the 18-plus checkbox (records `adult_confirmed_at`); Terms updated; a persona cannot be made public without it.
- Acceptance: a stranger leaves a reaction and a note that render on the page through `textContent`; the owner deletes one; a blocked account gets 403 from `/api/spark` and from `/api/chat` on that grid; the opt-in transcript appears only to the owner; a new account cannot publish without the checkbox; probes as anon and stranger on both tables; Worker tests up.
- Estimate: Claude Code one session; Clone 4 to 5 h; Flesh 2 to 3 weeks.

### M6. Kindred, Circle and persona-to-persona (one to two sessions)

What: relationships, and conversation between personas behind them.

- `sql/…_kindred.sql` per section 3.4; `twingrid_follows` brought into use; `twingrid_is_kindred`, the Kindred projection.
- Persona page: Follow (Circle) and Request Kindred (from one of the viewer's own personas); `?kindred` for requests, accepts, declines, blocks; the Kindred scope finally renders for accepted pairs.
- `/api/p2p`: one exchange per call between two Kindred personas, both composed from the Kindred projection, disclosed as persona-to-persona in the transcript, charged to the caller, shown on both persona pages as a TOGETHER action when both owners approve (default: proposed on both sides).
- Acceptance: a Kindred facet is invisible to a stranger and visible to the accepted pair (probe both); `/api/p2p` refuses non-Kindred pairs with 403; a declined or blocked request cannot be re-sent for 7 days; follower count shows on the page; the approved 2026-09-03 persona-to-persona plan's RLS attack passes for the authenticated role.
- Estimate: Claude Code one to two sessions; Clone 6 to 8 h; Flesh 4 to 5 weeks.

### M7. Places and business personas (one to two sessions)

What: a business claims a Place, verifies destinations, and staffs it with a persona.

- `sql/…_places.sql` per section 3.5; `twingrid_accounts.kind` in (person, business).
- `?places` directory of verified Places; `?place=id` with the storefront objects (sign, menu, booking, shelf, events, map) as verified outbound links only, the staff persona's chat composed with the Place's knowledge cell, and aggregate counts (visits, link clicks) for the owner.
- Verification v1 (Open decision 6, proposed default): the moderator verifies by a visible token on the business's own website or a reply from an email at the business's domain; recorded with method and evidence.
- Acceptance: an unverified Place is invisible to strangers; a verified one lists with its links; the staff persona answers a menu question from the knowledge cell and refuses to invent a price (test prompt in the Worker tests); counts increment without storing visitor identity.
- Estimate: Claude Code one to two sessions; Clone 6 to 8 h; Flesh 4 to 6 weeks.

### M8. Learning proposals (one session)

What: the persona notices; the owner decides.

- `sql/…_proposals.sql` per section 3.6.
- After an owner chat session (and, when the Kindred pair has `learning` on, after a p2p exchange), the Worker asks the model for at most one proposed cell change with a one-line reason and the evidence ids, writes it `waiting`, charges 1 credit.
- `?learned`: inspect source (links to the Sparks or actions), Keep and lock (applies the change as an owner save), Correct wording, Remove.
- Acceptance: a proposal never changes a cell until Keep; Keep produces a normal grid save visible in the editor; Remove leaves no trace in the grid; operator-only on the table (probe).
- Estimate: Claude Code one session; Clone 4 to 5 h; Flesh 3 weeks.

### Prototype Complete review (half a session, Dylan and Jennifer)

Walk the seven definition-of-done statements in section 0 on the live site as a stranger and as an owner, record the friction, and only then open section 6.

**Total for the prototype:** Claude Code 8 to 10 sessions; Clone Dylan 40 to 50 hours across four to six weeks of sessions; Flesh Dylan solo 6 to 9 months. Wall-clock that no tool compresses: Jennifer's review passes, the verification of a real business, and the week of clean CSP reports before the header leaves report-only.

## 6. The art track (Parked until Prototype Complete, prepared in parallel)

Ruled: the Home renders isometric Sims-style. The zoned page in M2 is the first render and stays as the fallback and the accessible alternative. The isometric scene needs an art catalog before a renderer, and the catalog is a production job, not a coding job.

| Step | What | Estimate |
| :---- | :---- | :---- |
| A1 | Style sheet: one isometric angle (2:1), one light direction, one palette derived from the owner's accent, a 64 px grid; three test objects rendered in Creative Studio and approved by Jennifer | Clone 2 h plus Jennifer's pass |
| A2 | The catalog: the same ~40 objects as sprites with transparent backgrounds and a `sprites.json` manifest (id, footprint in tiles, anchor, layer); eight room shells | Creative Studio batch, 2 to 3 sessions; review is Jennifer's |
| A3 | Renderer: a canvas scene on the persona page that places objects from `data.house` onto the room shell by zone, with hover labels and click to open the facet; the zoned page remains for reduced-motion and for screen readers | Claude Code one session; Clone 4 to 6 h; Flesh 6 to 8 weeks |
| A4 | Appearance and familiar (Jennifer 4.4): curated presets, several expressions, optional familiar from a small set; replaces the single portrait | After A3; Claude Code one to two sessions plus art |

## 7. Engineering rules for Claude Code (goes in the repo as `CLAUDE.md`)

These are the constraints the live product was built under. They are not preferences.

1. **One builder at a time.** Before the first write, confirm nobody else (Cowork, Antigravity, another Claude Code) has the repo open. Pull first. Small commits, one milestone per branch, merged by Dylan.
2. **Never commit or print a secret.** Cloudflare secrets are set in the dashboard or by `wrangler secret put`; Supabase secret keys go on the `apikey` header only, never Bearer. The publishable key in the page is public by design. If a secret lands in a diff, mark it burned and say so.
3. **RLS before prod.** Every new table or view: enable RLS, then `revoke insert, update, delete, truncate, references, trigger on <relation> from anon, authenticated, service_role, public`, then grant exactly what is needed. Supabase default privileges hand ALL to the API roles; a `revoke from public` alone leaves them intact.
4. **Grep policies before locking a table.** `select from pg_policy where pg_get_expr(polqual, polrelid) ilike '%<table>%'`. A policy on another table may depend on the grant you are about to remove; the policy is the gate, not the grant.
5. **Two-phase migrations.** Anything that changes what the live page can read ships as phase A (additive) before the code push and phase B (lockdown) after the push is proven live. The database is production; there is no staging branch.
6. **Attack every new object** with the publishable key over HTTP as anon and as a signed-in stranger, and with `set local role` in SQL, before the page reads it. Write the probes into the migration file's footer.
7. **No user HTML or CSS, ever.** Every render of user text goes through `textContent`. Images only as `<img src>` from our own bucket base. A theme is a preset key or a validated 6-digit hex. A room object is a catalog key.
8. **Page patches run the full loop:** extract the inline module, `node --check`, then `tools/run_stub.mjs` must print `TOP-LEVEL OK` (a first-paint call placed above the const it reads passed `node --check` and blanked the live site for 21 minutes on 2026-09-03), then measure every visual change at 1100 and 390 with `*{transition:none!important}` injected. A top-level call sits below every const it reads. The module declares `let history`; browser history calls are `window.history`.
9. **Worker patches:** `node worker/api.test.mjs` after every change; when tests are added the pass count goes up; new tests are mutation-checked against the old code (they must fail on it).
10. **Third-party facts are read off the vendor's live log or docs** before code is written on them. RevenueCat has no REFUND event. Refunds are issued from the RevenueCat customer page only. Billing is parked; do not touch `handleRcWebhook`, the packs or the offering without a founder ruling.
11. **Money rules.** Nothing runs on the founders' own model credits for free users; hosted usage is capped per account by the ledger; the capacity gate stays. A feature that spends credits says so in the UI before the spend.
12. **Disclosure.** Every public persona surface carries the AI persona label. Every autonomous post carries its authorship label. The guard preamble stays on every path that hands a persona to a model.
13. **Public palette for public pages** (`body.marketing` tokens), editor palette for the editor. Contrast 4.5 to 1 for text and 3 to 1 for non-text against both bases, measured, before a push.
14. **Vocabulary in the product** is Jennifer's: Owner, Persona, Handbook, Home, Familiar, Circle, Kindred, Spark, Place, Life log, Trail. The internal scope keys (house, visiting, lobby) stay in code; the words on screen are Private, Kindred, Public.
15. **No em dashes or en dashes** in any copy, comment or commit message.
16. **A claim is proven from outside** (curl, a fresh browser, a probe with the publishable key), never self-reported. "It works" without the probe output is not done.

## 8. Security checklist per milestone (the six standing checks plus three)

Run before any milestone is called done. Record the outputs in the PR description.

| Check | What passes |
| :---- | :---- |
| 1. Prompt injection | Every new path that hands persona text to a model carries the guard preamble; new user text fields are treated as data in that preamble; the injection-tell flag covers new public text (Sparks notes, starters, status). |
| 2. Login | New routes require a session where they should; operator delegation still holds; nothing owner-only is reachable signed out (probe). |
| 3. Backend | Table-level grants only; the new-relation revoke; policy grep done; service-role functions for anything that moves credits; anon and stranger probes recorded. |
| 4. Paid content | No new free spend of hosted compute; every credit spend announced in the UI; capacity gate respected by the cron tick. |
| 5. Persona image | Unchanged: images only from our bucket, media guard trigger intact. |
| 6. Personas talking to personas | Only behind Kindred; composed from projections; disclosed; charged. |
| 7. Two-phase migration | Phase A live before the push, phase B after proof, both in the migration file. |
| 8. Headers | Six headers unchanged; CSP still report-only until a clean week on the report endpoint. |
| 9. Moderation reach | Every new public text is reportable and every new relation has an owner-side delete or block. |

## 9. Measurement (Jennifer section 19, mapped to events we can log)

A `twingrid_events` table (service role write only, no personal data, one row per moment with account id hashed) lands in M0 and every milestone adds its moments.

| Moment | Event | Milestone |
| :---- | :---- | :---- |
| Discovery | `quiz_start`, `quiz_done` | M0 (exists in code paths today) |
| Recognition | `reveal_ok`, `reveal_adjust` | M0 |
| Ownership | `home_saved` | M1 |
| Trust | `handbook_opened`, `scope_changed` | M0 |
| Pride | `published`, `page_shared` | M0 |
| Connection | `spark_left`, `chat_started`, `follow`, `kindred_accepted` | M5, M6 |
| Agency | `rules_saved`, `action_approved`, `action_declined`, `step_in` | M4 |
| Retention | a weekly job counts owners and visitors returning to the same persona | M4 |

## 10. Open decisions (need a founder ruling before the milestone starts)

| Before | Decision | Proposed default |
| :---- | :---- | :---- |
| M3 | The five permitted and five prohibited Autopilot actions for v1 | Permitted: a daily public post, a room status change, a reply to a friendly Spark, a visit to a verified Place, a learning proposal. Prohibited: links out, purchases or bookings, contact with non-Kindred personas, anything from a private facet, more than `max_per_day`. |
| M5 | Retention of opted-in conversation Sparks | 90 days, then deleted; the owner can delete any time. |
| M5 | Moderation and appeals for Sparks | Report goes to the existing moderator view; a suspended account's Sparks hide; appeal by email to support. |
| M6 | May a persona initiate a Kindred request on its own (autopilot) | No in v1; owners request. |
| M7 | Business verification standard | Token on the business's website or an email from its domain, recorded by the moderator. |
| M8 | What data can be exported and what is permanently deleted | Export: the grid, the Home, the life log, the Sparks the owner received, as JSON. Delete: everything under the account, Sparks the account left on others' pages included, within 7 days. |
| Any | Which audience the first marketing push speaks to (private companion, public creator, or both) | Public creator; the private companion is served by the same build. |

## 11. Risks

| Risk | Mitigation |
| :---- | :---- |
| Autopilot cost runs away | `max_per_day` default 1, the capacity gate, the ledger; the cron refuses when the owner has no credits. |
| Sparks become a harassment surface | Blocks, reports, plain-text only, 280 chars, rate limit per account per day, moderator suspension hides everything from that account. |
| Two builders collide on the repo | Rule 1; Dylan announces which tool has the repo. |
| A migration blanks the live page | Two-phase rule; the policy grep; the attack probes; the outside md5 check after every push. |
| The isometric art stalls the Home | M2 ships the zoned page first; the scene is additive. |
| The plan drifts from Jennifer's document | Every ruling gets a decision-log row in both documents the day it is made. |

## 12. How to run a milestone with Claude Code

Open Claude Code in the repo and paste:

```
Read CLAUDE.md, then PLAN.md. We are doing milestone M<n> only. Before writing: git pull, confirm the tree is clean,
run tools/check.sh and report the result. Then build M<n> exactly as scoped: SQL first (phase A applied through the
Supabase MCP as a tracked migration, attacked as anon and stranger, outputs pasted into the migration file's footer),
then Worker with tests (pass count up, new tests mutation-checked), then the page (extracted module node --check,
tools/run_stub.mjs TOP-LEVEL OK, measurements at 1100 and 390). Open a PR titled "M<n>: <name>" whose description
carries the acceptance test results and the section 8 checklist with outputs. Do not touch billing. Do not start M<n+1>.
```

Dylan merges, watches the deploy, runs the outside checks (live md5 equals disk, headers, the probes named in the acceptance test), then applies phase B if the milestone has one.

## Decision log

| Version | Date | Change | Approved by |
| :---- | :---- | :---- | :---- |
| 1.0 | 2026-09-07 | First build plan, written after Jennifer's Living Master Plan v1.0 and the alignment of the same day. Records the rulings of 2026-09-06 and 2026-09-07: no free hosted allowance; stack kept; isometric Home as the target with the zoned page first; per-facet privacy with core and vibe public by default; merged order (reveal, Home, narrow autonomy, Sparks, Kindred and persona-to-persona, Places, learning); Jennifer's vocabulary in the product; opt-in conversation Sparks; 18 plus to publish; billing parked until Prototype Complete. | Dylan (founder); Jennifer to review |
| 1.1 | 2026-09-07 | M0 to M8 built the same day as nine stacked PRs (#1 to #9) by the 2026-09-07-1211 Cowork session; phase A migrations live (home, autonomy, sparks a and a2, kindred, places and follow-ups, proposals, accounts column grants); sparks phase B (the publish trigger) owed after M5 is live. Doors added: /lobby, /explore, /home, /personalhome, /visitingroom, /world, /places, and /spaces. Jennifer's 2026-09-07 mail adds: auto-Sparks by persona visits, "Kindred Connections" as the word, a plan ladder (parked under the billing ruling), the Lobby as a neighborhood (art track). Rulings owed: the Kindred Connections wording, auto-Sparks by persona visits, whose credit pays for Kindred learning. | Dylan to review the PRs; Jennifer to review the rows |
| 1.2 | 2026-09-10 | Art track UNPARKED ahead of Prototype Complete (Dylan, 2026-09-09, verbatim: "We want the house interactive on the webpage and maybe even a way to change the clothes of the avatar that is created"). Open-Source-First search, time-boxed, three lanes, verdicts: (a) isometric furniture sprites: BUILD FROM SCRATCH as primitive part lists rendered by the site (docs/iso.js, docs/catalog/sprites.json, CC0 dedicated by Potions and Familiars); Kenney Furniture Kit (CC0, 140 assets, soft-shaded 3D renders) and the OpenGameArt Isometric Furniture set (CC0, 64 by 32, four items) were read and rejected for this round because their shading and coverage do not meet the ruled A1 sheet (three tones, one light, accent tint, 40 named keepsakes), kept as the fork lane for a later Blender pass (Kenney's models rendered orthographic with a toon ramp). (b) The avatar: BUILD FROM SCRATCH as a flat paper doll from Jennifer's Step 2 and Step 3 specs (docs/avatar.js, docs/catalog/avatar.json); DiceBear (core MIT, styles CC0 or CC BY 4.0 by style) rejected because every style is a bust with no layered wardrobe and no adaptive fit, and the page's CSP forbids its CDN without vendoring; Open Peeps (CC0) rejected because its standing bodies carry baked clothing and an ink line style that does not match the ruled cel look, kept as a reference. (c) The renderer: BUILD, a hand-written painter's-order canvas over the 2 to 1 grid (no library; a 40-sprite scene does not need one). Billing, the plan ladder, shops and ads stay parked; nothing here spends hosted compute for a free user. | Dylan (founder); Jennifer to review the words and the contact sheet |
| 1.3 | 2026-09-11 | Dylan's beta test of the v15 Home, verbatim: "Do you realize that when you click on any of those pictures, all it does is just take you to the editor page? And then on top of that, the image is not great, man. Like, that's not a real house. Like, I was thinking, and I wish that you would have done research on the fallout shelter video game because those are kind of a little cheeky, a little, you know, animated, not a bobblehead exactly. But you are Fable five point one. I thought that you could do a little bit more than that. Um, if I need to increase your con... like, uh, model effort or something, let me know. but, overall, not very impressed." And: "Like, there is no question and answer part. There is no ability to answer the questions. Where do you click to answer any questions? It works on mobile, but it doesn't work on the desktop version. Like, and most people are gonna be building out the larger scope of their personas on desktop. We're not trying to build this for a mobile app." Verified behind it: the only Q and A in the product was the fourteen-question new-persona quiz (QSTEPS), so no question flow existed for an existing persona on any device, and no 800-question depth set existed anywhere; every click on the signed-in Home routed to the editor. The v16 plan, in order: (16.2) the page acts in place, one panel under the house (#pkhomepanel) opened by every door, the desk, the chest, the shelf, the hatch and the guide, each save re-reading the row and replacing only what it owns; (16.3) the question bank as repo content, docs/catalog/questions.json, about forty questions per facet across the nineteen facets, drafted as a spawned sweep with a mechanical checker, answered from the basement into the facet cells, shipped behind an owner preference until Jennifer reviews it; (16.4) real rooms with true depth and a big-head dweller, the route Dylan's call (Blender toon renders, painted interiors, or Jennifer's brush), the renderer contract unchanged; (16.5) four rulings in one picker: the art route, whether house.show hides data server-side, whether an object's label is stripped for a non-public facet, and which gate the question bank ships behind first. Desktop is the primary surface; mobile stays working and is never the reason to cut. | Dylan (founder); Jennifer to review the question bank |
| 1.4 | 2026-09-11 | Four rulings from the v16 picker, Dylan's answers of record. (1) The art route for the rooms: PAINTED INTERIORS, the Creative Studio's local SDXL paints the house backgrounds from the current cutaway render as the control image, our drawn figure and props stay on top; the renderer contract holds (scene.js draws from a manifest by key, a PNG layer replaces the primitive room shell with the same floor lines, the contact sheet shows every asset at both accents before the page reads it). Blender rooms and a rigged dweller stay the fork lane. (2) `house.show` STAYS a page preference: the house data is public through the Lobby projection by design (2026-09-07), the tick decides only whether the picture is drawn; no phase B. (3) An object's owner written label IS STRIPPED from the public projection when the object points at a facet that is not public, along with the facet: `sql/2026-09-11_house_label_strip.sql`, applied and probed the same day. (4) The question bank ships BEHIND THE OWNER PREFERENCE first, default off, until Jennifer has read it; her review lands as edits to `docs/catalog/questions.json`. | Dylan (founder) |
| 1.5 | 2026-09-11 | Dylan's afternoon asks after the v16 merge, verbatim: "Sorry for having to neg you, but this is very impressive." Then: "I would like to do an adversarial review, so please review a prompt for that, and then let's vault and log here. Find what else just based on other market research and also from what else you can see as improvements as well." On onboarding: "the quick and dirty, like, how to create a persona of you, answer the first twenty questions when you first sign up." On the backend: "it's the super base back end and everything else ... let's make sure that this this is really getting to be something." On the product model: "I love how you implemented clicking the lamp shade opens up those specific personas. But with those personas, we gotta also be able to make sure that we don't give them just the generic ones that we have, but when they do start creating their own, how do they switch edit from..." and "once you log in, you see your house, and then you do have at the very top, you know, me and then the at clone, but then you have all these different personas at the bottom, and you can call upon all of them. Right? We need just the house for the one, and then for it to add those different hats ... The personality matrix says the clone is the persona, but those different hats that you and that other AIs can do, which is becoming different skill masters in a matter of seconds instead of humans that take years, that's the difference. And also being able to do the do's and don'ts in those is very needed. But how do we show that?" The v17 plan, in order: (17.2) one house, many hats: the signed-in Home shows the owner's own twin's house (the grid marked `data.twin`, a top level key no projection carries, a one time picker if none is marked); other grids list under it as Characters and businesses; the doors become Add a hat first (eight packs, each a template's core facet renamed onto the twin as a new door on the floor the owner picks) and Start a separate persona second; the door panel gains Wear this hat and talk (the chat's composition, the hat named on the chat header, the register a separate dial); a custom hat is a name, a kind, a floor and five cells from the blank guidance, with twenty five generic hat questions in the bank under facet `hat` for the basement; the persona page shows What it can be, one line per hat with a Do and a Don't sentence from its cells. (17.3) the twenty question start: a new account lands in the quiz, the fourteen plus six weight three core questions from the bank named in the code, then the reveal, then the Home. (17.4) the dweller alive (a two frame idle, reduced motion on the first frame), a style anchor for the shells, plaques become doors. (17.5) four rulings in one picker: twin by flag or first grid; hat packs replacing the template personas; a custom hat Public on day one; the style anchor image. The adversarial review runs only after Dylan approves its prompt; nothing spends hosted compute for a free user; billing stays parked. | Dylan (founder); Jennifer to review the words (hat, twin, What it can be) |
| 1.6 | 2026-09-11 | Three rulings from the v17 picker, Dylan's answers of record. (1) The twin is MARKED BY A FLAG the owner sets once (`data.twin`, a one time picker under the house, "Not you?" to unmark), not simply the first grid: his own account made My Coach before himself. (2) HAT PACKS COME FIRST and the template personas STAY for characters and businesses: Add a hat is the first door, Start a separate persona keeps the three old doors, existing template grids are untouched. (3) A custom hat MAY BE PUBLIC ON DAY ONE: the owner picks the floor, the default is Private (Basement), Kindred and Public are one pick away under the same rules as any facet. (4) The style anchor: no image chosen; Dylan asked for idea images generated in his own Chrome ("I like the bobblehead or the Wii kind of reference idea for the avatars"), so the anchor leg starts with references for the FIGURE (big head, simplified geometric features, flat cel colour) and the rooms follow the figure; the pick stays his and Jennifer's. | Dylan (founder) |
| 1.7 | 2026-09-11 | Dylan's evening asks after #35 to #38 merged, verbatim: "this email me a sign in link is also wrong. It should be a standard 'account login' already have an account? create account? all that, no sign in link"; "now that we got the real house built (i still don't see the updates online) I would like to try and do a full build of you with the MCP connector as well and see how that changes how the 'house' is made. Does the questions auto fill from the agent MCP connector when possible? these are things we need to work on as well. Visual presentation and actual functionality"; then, mid-round, "also need to review https://personakind.com/?life and what and how it can easily tie in. I think we need a full breakdown and rebuild of at least the persona's page". The v18 plan, in order: (18.1) QA; (18.2) the cheap paste lane, branch agent-paste: nfInterviewText carries the twenty (fourteen QSTEPS plus six PK_START_QS), the basement gets "Let my AI answer these" per facet, every paste lands through the same save path as a typed answer via one shared parser (pkagParse) and mapper (pkagMap), an id the facet lacks ignored, a choice outside its options dropped and counted; (persona-page) the public /@handle rebuild: one avatar not two, "What it can be" (the hats, a Do and a Don't) leads, "What it's like" is the core narrative only, the full facet grid folds behind "The full handbook"; (18.3) the real write lane, branch agent-write: phase A schema written not applied (twingrid_agent_tokens service-role only with the hash never leaving the Worker, a hash-free definer view twingrid_agent_tokens_mine, twingrid_agent_writes receipts), the Worker mint and write routes, the two MCP write tools and the consent copy build next and ship as one reviewed unit; (18.4) PROMPT_adversarial_v18.md staged, Opus, read only, run after Dylan approves it, CONFIRMED HIGH and MEDIUM triaged before the real lane merges and before any further page work merges. Rulings of record (v18 picker): (a) build order persona page, then the real lane, then the review, honored as build order with the review gating every merge; (b) MANY tokens per account each with a LABEL, NO expiry; (c) an agent write lands PRIVATE, the owner flips the floor; (d) Confirm email inferred OFF from the auth confirmation timestamps (sub-second gaps = auto-confirm), the GoTrue toggle itself not SQL-readable through the connector so it is a strong inference not the dashboard value. Jennifer owes the words: "The full handbook", "What it can be", "A little deeper". | Dylan (founder); Jennifer to review the words |
| 1.8 | 2026-09-11 | The agent write lane shipped end to end, PRs #41, #44 and #45, all merged and deployed. Phase A (the token schema) was already applied; phase B is four Worker routes (`POST /api/agent/token` and `/token/revoke` on the owner's Supabase JWT, `POST /api/agent/answers` and `/cells` on an agent token read from the Authorization header ONLY); phase C is Agent access on the account page (mint, the one-time reveal, the key list from the hash-free view, revoke, the write log, and a usage block). A token is 32 random bytes as `pka_<base64url>`; only its sha256 hex is stored, and the raw key exists in exactly one response and nowhere else. The write rules are ports of the page, not new ones: a fresh read of `data`, `pkhpAppend`, the basement sentence rule, the 40,000 cell cap, `depth.done` keyed `id` or `id@facet`. Two rulings of record this round, both Dylan's, both picker answers: (a) Private-until-flip stays conservative (the routes send only the `data` column, so they can never write `is_public` or a facet's `scope`) WITH a core-only exception, because core and vibe are already Lobby-visible, so a write into an already-opened facet returns 409 `would_be_public` unless the caller says `allow_public`; (b) `/api/agent/cells` with `create` may make a hat, and a hat a route makes is ALWAYS scope `house`, whatever the body asks for. Both were proven against production, including a hat created with `"scope":"lobby"` in the body landing at `house`. The live probe gauntlet found one defect thirteen offline tests and a full schema read had missed: Postgres stores jsonb with a space after every colon and comma, so `data::text` runs thousands of octets longer than `JSON.stringify`, which made the Worker's size check structurally optimistic against `twingrid_grid_data_size` and returned a full persona as `save_failed`; #44 patched the code and #45 replaced the guess with the database's own SQLSTATE. The Opus read-only re-review of the live lane (attack items 7g, 7h, 7i) returned SHIP WITH FIXES and verified both rulings load-bearing by mutation; its three MEDIUM findings are all fixed in #45 (the guard widened from the Public floor to the Kindred floor because `twingrid_kindred_proj` carries `visiting` to both sides of a persona-to-persona run, which WIDENS ruling (a) and is one token to narrow back; the rate limit rekeyed from the resolved row id to the hash and moved before the lookup, because a revoked token was skipping the limiter entirely and costing a SELECT plus a PATCH per attempt; and `twingrid_agent_writes`, written and never read, now shown on the account page with the token line relabelled "last seen" because `last_used_at` stamps on refusals too). Also in #45: compare-and-swap on the grid PATCH via `updated_at`, `vibe` reserved alongside `core` in `pkHatName`, a byte-accurate body check, and `sql/2026-09-11_agent_tokens_view_grant.sql` closing a `service_role` SELECT the first migration's revoke list missed. Tests 89 to 108, every new one shown failing first. The MCP connector stays READ ONLY: no write tools were added and the reviewer confirmed all four still carry `readOnlyHint`. Owed: the mint route's happy path is the one path not exercised live, because it needs a signed-in owner session. Not built, deliberately: the pending-content model, which is its own round if Dylan wants it. | Dylan (founder), both rulings given as picker answers 2026-09-11 |
| 1.9 | 2026-09-13 | The Room talks from the right place. Three PRs on one thread, each on its own worktree against main: #52, the room's hero image loads eagerly at high fetch priority (lazy was the empty first frame, and a lazy image does not hold the load event); #53, the owner's room controls, both saved on data through one data-only read-modify-write: click the portrait once to place the mouth (data.face as fractions of the face box, clamped, portrait only because the doll measures its own tagged mouth path) and pick which character stands when a persona has both a portrait and a Look (data.hero, honoured only when there is something behind it), in their own strip under the top bar so the bar never wraps at 390 and nothing is drawn over the character; the viewer is the owner when the base table answers, because its RLS select policy is twingrid_operates(owner), the same test its update policy uses, and the harness stub now answers the base table only with a session. Every new assertion red before the build and green after; check.sh 109 worker and 105 engine; harness proofs at 1100 and 390 with transitions off, signed in and signed out. Rulings of record, Dylan's picker answers 2026-09-13: (1) mouth placement is the owner's click in the room, nothing in the editor; (2) portrait versus doll is an owner toggle in the room, saved on data; (3) the agent write guard STAYS at the Kindred floor (any facet not house on a published persona refuses a write without allow_public), one token to narrow later; (4) when MCP write tools are built, the agent key lives on the connection as an Authorization header, never as a tool argument, with the honest limit that claude.ai custom connectors offer OAuth or nothing, so that client would need OAuth on /mcp. Dylan merges every PR himself (the working agreement; the session's own merge attempt was refused by its tooling), and the live frames on the one persona that carries a portrait follow the merges as PR comments. Owed: those live frames; the test agent key stays live until Dylan says everything is good; the 18-plus confirmation on his account before My Creator can publish. | Dylan (founder), rulings as picker answers 2026-09-13 |
| 1.10 | 2026-09-13 | The showpiece pass, on Dylan's word the same afternoon, verbatim: "we need to get this to an actual cool looking website ... Stay on task with personkind.com let's get this to a website that is actually usable and reaches the high standard of what I want accomplished." The site was read as a visitor at 1280 and 390 and the finding was faces: nine showcase personas rendered as letter plates on Explore, on their pages, in their rooms and on the landing, the Room stood a primitive paper doll on a gradient, the landing sold with paragraphs and a mock card of cells, and two console lines (the chat's composition readout, Explore's hosted-capacity readout) showed to visitors. Shipped: nine painted portraits in one house style (oil, warm light, the site's violet), generated locally at no cost, the eight official showcase personas given theirs through the product's own upload path working as the official account, mouth anchors seeded on data.face per portrait so the Room's mouth sits on the mouth today; #55 the console lines off the visitor surfaces; #56 the landing hero as a wall of faces linking into rooms and the persona page leading with the portrait at real size plus a Talk to it button. Owed to Dylan: the ninth portrait (My Coach, his own persona) is his upload, the merges of #52 to #56, and after them the live frames. Next on the standard: painted room interiors behind the character (the catalog's eight paintings are house cutaways, not rooms), the paper doll's art bar, the persona page's density, and the hosted-chat line a visitor reads in the room, which is billing and parked. | Dylan (founder), the ask in his words 2026-09-13 |
| 1.11 | 2026-09-13 | The whole website to the standard, v21, six stacked PRs (#57 to #62) against main, Dylan merges bottom up. The QA walk as a stranger at 1280 and 390 found the five-spark review at pixel 1612 of 2181 under the facet prose with zero public ratings in the database, a persona page that read as a document, a Room with no room, an Explore that listed internal counts and dates, and a landing that mocked the product below the fold. Shipped: (21.3) the persona page as the profile, a cover band behind the portrait, the rating summary beside the AI persona pill from the read-only aggregate, Talk to it and Request Kindred as the two buttons, then one column: Home, the Guestbook with the Spark box first, Kindred as faces, Lately, the handbook folded with the core narrative open; (21.4) twingrid_spark_scores, a read-only view keyed by persona, applied to production as phase A and attacked as anon, stranger and service role with the outputs in the PR, read once by Explore for every card and by the Room's bar, plus Rate this persona opening the Guestbook's own box from the Room; (21.5) eight painted interiors as stage paintings by house room key through the manifest, never a path from data, behind the Room's character under a vignette and as the profile cover when the persona has a house room; (21.6) Explore as a face, a name, its rating, its mood and one sentence per card; (21.7) the landing showing two real product frames below the fold, a two-sentence hero, the stale email-link notes gone; (21.8) the chat placeholder in plain words, every surface measured at 390. Every new test shown failing first; check.sh green on every branch; the numbers in every PR body come from the harness with a real portrait at 1280 and 390 on both owner bases with transitions off. Four of the five rulings the round asked for were answered by default because the founder was not in the room and each is a one-line flip, recorded in the PR bodies: the word on screen stays Sparks; the cover is the blurred portrait or the room painting; the rating shows on all three surfaces; the eight interiors ship now. The paper doll is untouched. Owed: the merges, then the live frames as PR comments, signed out and signed in; the landing's two frames re-captured from the live site after the merges. An adversarial review of the whole stack (three finders, two refuters a finding, 33 agents) surfaced fifteen findings and no security defect, all fifteen fixed on the 390-pass branch, each asserted red then green. | Dylan (founder), the standard in his words 2026-09-13; the defaults await his rulings |
| 1.12 | 2026-09-13 | Maintenance, v22: the adversarial review's leftovers, on an Opus session beside the v22 product session. (#64) the review's database migration, already applied, footer probes 46 to 51 re-run on production and pasted as a comment, with two corrections to the footer (probe 48 needs two owners; probe 49 shows authenticated holds no INSERT on image_url, so the column grant is the first wall and the insert trigger the second). (#65) the Worker's four: the autopilot tick selects kind so the invite and visit guards run, rateLimited calls the atomic twingrid_rate_hit with KV as the fallback and the tick sweeps rows older than two days, /api/csp-report reads through readJson, /mcp refuses a batch over 16; each check red before its fix, 115 tests. (#68) the page sweep a to r (routes, the paid voice consent, the Room's Spark row, close buttons, root-absolute Terms, support, about, pricing and changelog words, noscript, the chat log role, Explore limit 48, cover priority, the Fraunces italic, caching, render-once guards) and the founder's two rulings of 2026-09-13 from one picker: his own grid no longer ships in #showdata (New from showcase seeds from the fictional Founder template) and the RevenueCat SDK is a dynamic import on the buy path, page 726,003 bytes to 557,153. The changelog dates were corrected from git history in review. Left for its own session: per-persona titles and Open Graph cards with a real 404 (review 20), and one fully built member persona so every Prototype Complete statement has a URL (review 23). |
| 1.13 | 2026-09-13 | v22 product pass (Opus 4.8, product only, design first, four stacked PRs #66/#67/#69/#71 for Dylan's merge, bottom up firstrun then landing then explore then room). To the standard "screams high end, usable by children, web first." (22.1) the hero and closing Build-your-persona-free CTAs route into the questionnaire via data-path so a new person lands on question one, not a signed-in dead end (verified: the hero sets pk_pending_path). (22.2) the landing cut from 447 visible marketing words to 209, under half, three essays now three labelled doors, held at or under 223 by tools/landing_words.mjs in check.sh step 0d. (22.4) Explore ratings as a five-spark row filled to the human average with Be-the-first at zero, not a flat No-sparks-yet. (22.3) the empty Room chat now the persona's face and a one-line invitation, not a black void; the painted studio stage was already fine (the earlier black read was a bucket load race). Every phase a new assertion red first, check.sh green, framed at 1280 and 390 on a local serve or live public data. Not built: a live account and publish (I create no account, so 22.1's live signup-and-publish and every surface's live frames are Dylan's after merge); the 18-plus checkbox gating account creation where the product rule gates only publishing (a founder ruling, flagged); 22.3's streamed-reply bubbles and the sign-in-free first reply (the credits lane, out of the product-only scope). Stacks after #70's row 1.12; resolve the table on merge. | Dylan (founder), the standard in his words 2026-09-13 |
| 1.14 | 2026-09-14 | Account self-service, backend first. Dylan, verbatim: "we need users to be able to change passwords, delete accounts, all the stuff that is normal in any type of subscription based service. Let's not hide it, it should be easy to do all of that." (#76) the account box on the owner's page becomes Account settings, six rows in words, each two taps from a signed-in Home: Change password (8 character floor, confirm field, a stale session sent to sign in), Change email (the link to the new address), Manage subscription (plan line, See plans, Manage or cancel), Sign out everywhere (the only global sign out), Download my data (the caller's own rows as JSON); every plain Sign out is now this device only, because supabase-js 2.115 defaults signOut() to the global scope, which was the 2026-09-13 founder sign out; Account with no handle opens ?account instead of Home. (#77, stacked) Delete account: twingrid_account_footprint and twingrid_delete_account, service role only, applied and attacked as anon and as a signed-in role (42501 in SQL, 401 over HTTP); POST /api/account/delete reads the account off the JWT only, deletes the caller's own files first, then the rows and the login in one transaction; a dry run names what goes and the page arms the red button only on DELETE typed. Ruling of record, Dylan 2026-09-14, verbatim: "delete everything. If someone wants their account deleted we need to delete their personal information as well. only keep charges on record for the account for the required time for tax purposes". So the delete also covers the print portal on the shared auth.users (profiles, saved designs, admin rights, the caller's folders in customer-uploads and generated-pdfs); charges stay (ledger rows of kind purchase, renewal and refund, and print orders with name, email, phone, notes and artwork path blanked); only an official account is refused. No purge of kept charges exists yet; the retention period is a founder and CPA call. Every new check red first; Worker tests 118 to 128. Owed: the live acceptance on a throwaway account (Dylan creates it), the four branded auth emails and the email rate limit in the Supabase dashboard (templates staged in the vault). Rulings owed: the hosted-chat wall at message one, the 18-plus gate at signup. | Dylan (founder), the ask in his words 2026-09-14 |
| 1.15 | 2026-09-14 | The splash plan, from the competitive audit (vault: insights-2026-09-14-personakind-competitive-audit, plan-2026-09-14-personakind-splash). Dylan, verbatim: "I need to make sure that this website is up to snuff with the top AI websites that can create personas or twins. We have to be a major splash in a giant ocean to get noticed right now", then "first make the plan ... and then execute that plan". Read live first: 9 public personas (8 official), no ratings, 0 to 7 visits in 14 days, so discovery features are capped by supply and must never show an empty control or a weak number. Built the same night as PRs for his review: (S1) the landing's wall of faces leads with a Persona of the day, rotating daily, its portrait, one-line summary and a Does and a Won't line from its public cells, Hear it on the free browser voice, Talk to it and Read it, no model call and no hosted credit for a signed-out visitor; (S2) Explore search over name and summary and a sort of Popular (by twingrid_visit_count, order only, counts never shown), Newest, and Top rated rendered only once a rating exists, no new database object. Category chips wait for about 24 public personas. Rulings owed, in order of leverage: seed 20 to 30 more showcase personas with painted portraits (supply moves every discovery feature more than code); a real reply in the hero would spend founder credits on a signed-out visitor, which the money rule forbids, so a capped free first message is his call; named public figures are impersonation risk, the safe version is opt-in real creators; embeds need X-Frame-Options relaxed, a security ruling; creator payouts and a plan ladder stay parked with billing; age assurance rides the open 18-plus ruling; the auth Site URL is still the retired GitHub Pages host. | Dylan (founder), the ask in his words 2026-09-14 |
