# Hosted Haiku: Dylan's setup checklist

Plain language, in order. Everything marked **[DYLAN ONLY]** needs your logins or your card and cannot be done by Clone Dylan. Everything else is done or can be done by a session with the repo.

What you are wiring up, in one sentence: a reader with no API key clicks Buy, RevenueCat charges $5 through Stripe, RevenueCat calls our Worker at `https://personakind.com/api/rc-webhook`, the Worker adds 500 credits to that reader's row in Supabase, and every hosted message spends one credit before the Worker calls Claude Haiku with OUR key.

Sources used are linked at the bottom. Checked 2026-09-01.

---

## Part 1. Supabase (database)

1. **[DYLAN ONLY]** Open the Supabase dashboard for project `jpepcqazscmhakxvutpg`, go to **SQL Editor**, paste the whole of `sql/2026-09-01_credits.sql`, run it. It creates `twingrid_credits`, `twingrid_credit_events`, and two functions. It touches nothing else (the project is shared with the print app; every object here is `twingrid_` prefixed).
2. Run the probes in `sql/attack.sql` one block at a time. Each block's comment says what MUST happen (a permission error for anon and authenticated, success for service_role). If any denied probe succeeds, stop.
3. **[DYLAN ONLY]** Copy the **service_role** key: Project Settings > API Keys > `service_role` (marked secret). You will paste it into Cloudflare in Part 5. Never put it in index.html.

## Part 2. Anthropic console (the key that pays for readers' chats)

4. **[DYLAN ONLY]** Go to https://console.anthropic.com. Create a NEW API key named `personakind-hosted`. Do not reuse a personal key: if this one leaks you revoke it alone.
5. **[DYLAN ONLY]** Set a monthly spend limit on the organization or workspace: Settings > Limits (the console lets you cap monthly spend per workspace). Haiku 4.5 is $1 per million input tokens and $5 per million output tokens (https://platform.claude.com/docs/en/models/overview). A 500-message month with a 4k-token persona and 700-token replies is roughly 500 x (4,000 x $1 + 700 x $5) / 1,000,000 = about $3.75 worst case per subscriber, so a $50 cap covers the first dozen subscribers with headroom. Raise it as sales grow.
6. Model id in the Worker: `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`). Anthropic lists retirement "not before 2026-10-15" for this model, so expect to change `HOSTED_MODEL` in wrangler.jsonc when the next Haiku ships. That is a var change and a redeploy, not a code change.

## Part 3. RevenueCat (the store)

RevenueCat has three "web" flavors. We want **RevenueCat Billing** (their engine, Stripe as the card processor). The docs recommend it for new web setups and it is the one the Web SDK code in `frontend/pro-card.html` targets.

7. **[DYLAN ONLY]** Sign in at https://app.revenuecat.com. Create a project called `Personakind` if there is none.
8. **[DYLAN ONLY]** Connect Stripe: Account settings > **Connect Stripe account**. This installs the RevenueCat app inside Stripe. Only the project owner can do this (collaborators cannot). If you do not have a Stripe account yet, the button lets you create one. Source: https://www.revenuecat.com/docs/web/connect-stripe-account
9. **[DYLAN ONLY]** In the project, go to **Web** (bottom of the left menu) and create a **RevenueCat Billing** app config. Pick the Stripe account you just connected as the payment gateway. Name it `Personakind Web`.
10. **[DYLAN ONLY]** Copy the two public API keys the config shows. The one starting `rcb_sb_` is the **sandbox** key (test purchases). The one starting `rcb_` without `_sb` is **production**. Paste the sandbox one into `RC_WEB_BILLING_KEY` in `frontend/pro-card.html` for now.
11. **[DYLAN ONLY]** Products: in the Web Billing app, **Products > New**. Identifier must be exactly `pk_hosted_500_month` (this string is also the key in the Worker's `CREDIT_PACKS` var; if they differ, purchases are ignored and nobody gets credits). Type: subscription, period 1 month, price $5.00 USD. Display name "Hosted Haiku". Source: https://www.revenuecat.com/docs/web/web-billing/product-setup
12. **[DYLAN ONLY]** Entitlement: Project > Entitlements > New, identifier `hosted`, attach the product `pk_hosted_500_month`. (The Worker does not read entitlements, it counts credits. The entitlement is there so RevenueCat's dashboard and customer portal make sense.)
13. **[DYLAN ONLY]** Offering: Project > Offerings. Use the `default` offering, add ONE package (type Monthly) containing the Web Billing product `pk_hosted_500_month`. Make `default` the current offering. The page code looks for `offerings.current.availablePackages` and matches the product identifier.
14. **[DYLAN ONLY]** Webhook: Project > **Integrations > Webhooks > New**.
    - URL: `https://personakind.com/api/rc-webhook`
    - **Authorization header**: paste a long random string you invent (32 or more characters). Save it somewhere; you will paste the SAME value as the Cloudflare secret `RC_WEBHOOK_AUTH` in Part 5. RevenueCat sends this value verbatim as the `Authorization` header on every POST and the Worker rejects anything else with 401.
    - Environment: while testing pick **Sandbox and Production**. Before real launch you can leave both on; sandbox purchases only happen with the sandbox key, which will not be in the live page.
    - Events: leave all on. The Worker only acts on INITIAL_PURCHASE, RENEWAL and NON_RENEWING_PURCHASE and answers 200 to everything else.
    - Source: https://www.revenuecat.com/docs/integrations/webhooks
15. Optional, later: RevenueCat also offers HMAC signing (`X-RevenueCat-Webhook-Signature`). The Worker does not verify it yet. The Authorization header is what the current code checks.

## Part 4. Stripe: test vs live, and what "sandbox" means

16. RevenueCat Billing "sandbox" = Stripe **test mode**. When you make a purchase with the `rcb_sb_` key, RevenueCat automatically routes it to Stripe test mode, no real money moves, and the webhook arrives with `"environment": "SANDBOX"`. Source: https://www.revenuecat.com/docs/web/connect-stripe-account ("RevenueCat will automatically use Stripe's test mode for sandbox web purchase links and web SDK purchases").
17. **You do NOT need Stripe fully activated to test.** The docs say: "If your connected Stripe account doesn't have access to live mode, only RevenueCat sandbox purchases can be made (only sandbox API keys and web purchase links will be available)." So: connect Stripe, test with the sandbox key today, finish Stripe's identity and bank verification whenever, and the production key appears once Stripe grants live mode.
18. Test card for sandbox checkout: **4242 4242 4242 4242**, any future expiry such as 12/34, any 3-digit CVC, any name and postal code. Source: https://docs.stripe.com/testing
19. Sandbox subscriptions renew every **5 minutes** for a monthly product and stop after six renewals. Each renewal fires a RENEWAL webhook and grants another 500 credits to the test user, which is exactly what you want to watch in the Supabase table. Source: https://www.revenuecat.com/docs/web/web-billing/testing
20. Never publish the sandbox key or a sandbox purchase link. Sandbox purchases can attach real entitlements to real accounts.

## Part 5. Cloudflare Worker

21. Merge the `vars` block from `worker/vars.example.jsonc` into `wrangler.jsonc`. Do not add a `kv_namespaces` entry unless you also create the namespace; the code skips rate limiting when `RATE_KV` is absent.
22. **[DYLAN ONLY]** Set the three secrets. In PowerShell, in the worker folder, one at a time; each prompts for the value:

        & "npx.cmd" wrangler secret put ANTHROPIC_API_KEY
        & "npx.cmd" wrangler secret put SUPABASE_SERVICE_ROLE_KEY
        & "npx.cmd" wrangler secret put RC_WEBHOOK_AUTH

    `ANTHROPIC_API_KEY` from step 4. `SUPABASE_SERVICE_ROLE_KEY` from step 3. `RC_WEBHOOK_AUTH` is the same random string you typed into RevenueCat in step 14.
23. Deploy:

        & "npx.cmd" wrangler deploy

24. Check it answers: open `https://personakind.com/api/credits` in a browser. You should see `{"error":"unauthorized"}` with status 401. That means the route is live and the auth check works.

## Part 6. The page

25. Apply `frontend/hosted-chat-snippet.js` and `frontend/pro-card.html` to `docs/index.html` following the comments at the top of each file (replace `sendChat`, point the two chat buttons at `openChat()`, add the `#creditsline` div, paste the card markup and script). Push.

## Part 7. End-to-end sandbox test

26. Sign in to personakind.com with a test account. Open a public persona, click Chat with no key saved. You should see "Hosted chat: no messages left" and the Pro card.
27. Click **Buy for $5 a month**. RevenueCat's checkout opens over the page. Enter any email, card 4242 4242 4242 4242, 12/34, 123. Pay.
28. Within about a minute the card should say "You have 500 hosted messages". If it does not: RevenueCat > Customers > find your user id > Events tab shows the webhook attempt and the response code from our Worker. A 401 there means the Authorization value in RevenueCat and the Cloudflare secret do not match.
29. Send a message. The credits line drops to 499. Check Supabase: `select * from twingrid_credit_events order by id desc limit 5;` shows a `purchase` row with `ref` equal to the RevenueCat event id and a `use` row.
30. Wait 5 minutes: a RENEWAL webhook lands and the balance goes to 999. That is sandbox acceleration, not a bug.

## Part 8. Go live

31. **[DYLAN ONLY]** Finish Stripe activation (identity, bank account) so the production `rcb_` key appears in RevenueCat.
32. Swap `RC_WEB_BILLING_KEY` in index.html to the production key. Push.
33. Buy once with a real card to confirm, then cancel from RevenueCat's customer portal or refund it in RevenueCat > Customers.

---

## Doc sources

- Claude models and ids: https://platform.claude.com/docs/en/models/overview
- RevenueCat webhooks (setup, Authorization header, retries, duplicates): https://www.revenuecat.com/docs/integrations/webhooks
- RevenueCat webhook event fields and types: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
- RevenueCat Web SDK (purchases-js API): https://www.revenuecat.com/docs/web/web-billing/web-sdk
- Connect Stripe, test mode vs sandboxes, live-mode note: https://www.revenuecat.com/docs/web/connect-stripe-account
- Testing web purchases, sandbox renewal timing: https://www.revenuecat.com/docs/web/web-billing/testing
- Web Billing product setup: https://www.revenuecat.com/docs/web/web-billing/product-setup
- Stripe test cards: https://docs.stripe.com/testing
- purchases-js on npm (1.55.0, 2026-08-29): https://www.npmjs.com/package/@revenuecat/purchases-js
