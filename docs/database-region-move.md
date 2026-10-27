# Moving the database to Frankfurt

Status: **plan, nothing done yet.** Written 2026-10-27 after measuring production.

## Why
- The Supabase project `crust-and-co` is in **Seoul** (`ap-northeast-2`). Customers are in **Wesel, Germany**.
- Today the server functions run in Seoul (`icn1`) next to the database, so one request makes one long trip (Germany to Seoul, about 280 ms each way) and then talks to the database quickly. Measured server time is about 70 ms for a read and 290 ms for placing an order.
- With the database **and** the functions in Frankfurt (`eu-central-1` and `fra1`), the same request would cost about 20 ms of network plus the same server time: roughly **0.1 s for a read and 0.35 s for an order**, instead of about 0.35 s and 0.6 s now. Reads from the CDN get no benefit (they are already served near the customer).
- There are **no real customers or orders yet**, so this is the cheapest moment to move. Later it means migrating live customers.

## What lives in the project
| Thing | How it moves |
|---|---|
| Tables and functions (8 migrations) | `supabase db push` to the new project; the migrations are the source of truth (`npm run test:migrations` proves they apply from nothing) |
| The menu (15 categories, 188 products, options, prices) | `node --env-file=.env.local scripts/seed-menu.mjs --apply` (safe to repeat) |
| Offer banners | The migration inserts the four printed offers; edit them in the dashboard |
| Pictures (products, categories, thumbnails) | Re-upload from the `out/` folder with `scripts/import-images.mjs` and `scripts/make-thumbnails.mjs` (storage objects are not part of a database dump) |
| Staff accounts (`auth.users`, `staff_users`, modules) | Create the first super admin with `scripts/create-super-admin.mjs`, then add the others in the dashboard (Users). Passwords cannot be copied across in a way worth the risk; people set new ones at first sign-in |
| Customers, devices, orders | **Test data only today.** Nothing to carry. If real ones exist when this is done, they need a data dump/restore of those tables (see "If there are real orders") |
| Coupons, delivery zones, settings | Created by the migrations (`WELCOME5`, `PIZZA2`, `FEAST10`, zones, settings row) |

## Steps
1. **Create the new project** in Supabase: same organisation, **Region: Central EU (Frankfurt)**, a new database password (store it in a password manager). Name it `crust-and-co-eu`. Check the plan (Pro recommended for backups, see the readiness review).
2. **Staging first (optional, recommended).** Point `backend/.env.local` at the new project (URL, publishable key, service-role key; a new `SESSION_SECRET` is not needed). Everything below runs against the new project only. The old one is untouched.
3. `cd backend && npx supabase link --project-ref <new ref>` then `npx supabase db push`. Expect eight migrations.
4. `node --env-file=.env.local scripts/seed-menu.mjs` (dry run), then `--apply`. Expect 15 categories, 188 products.
5. `node --env-file=.env.local scripts/create-super-admin.mjs "Name" email@example.com`. The temporary password goes to `.first-super-admin.txt` (git-ignored); do not paste it anywhere.
6. Start the dashboard locally (`npm run dev`) and run `scripts/import-images.mjs ../out`, then `scripts/make-thumbnails.mjs ../out`. These use a local session against the local server, not production.
7. **Check against a local server:** `node --env-file=.env.local scripts/catalog-audit.mjs` (every product and size priced), and `npm run test:migrations`.
8. **Switch production (a few minutes):**
   1. In Vercel, project `pizza-app-fullstack-backend`, Production environment: replace `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (keep them *sensitive*, no byte-order mark: use the same method as before).
   2. In `backend/vercel.json` set `"regions": ["fra1"]`, commit and push (this also redeploys).
   3. Run `scripts/prod-smoke-check.mjs` and `scripts/latency-check.mjs` against production. Expected: smoke test all green; server times about the same as now, "waited" much lower from Germany.
9. **Log in to the dashboard** with the new super admin, change the password, add the other staff, confirm Settings and Offers load.
10. **Keep the old project for a week** (paused or running) as a fallback, then delete it. To roll back at any time before deleting it: put the three old values back in Vercel and set the region back to `icn1`.

## Downtime and risk
- Customers are not affected until step 8, and the switch itself is a redeploy: under a minute where requests may fail. Do it at a quiet hour.
- Apps already installed keep working: they only know the Vercel URL, which does not change. Their guest tokens exist only in the old database, so **every installed app registers a new guest on its next call** (silent, automatic). This is why it should be done before launch, while guests are test data.
- A mistake in step 8.1 (wrong key, a stray invisible character) makes the API return errors. The smoke test in 8.3 catches it at once; rollback is the same step with the old values.
- Storage URLs change (`https://<ref>.supabase.co/storage/...`). The app and dashboard read image addresses from the API, so nothing is hard-coded; old cached images simply reload.

## If there are real orders by then
Dump and restore only the customer tables (`customers`, `customer_devices`, `customer_addresses`, `orders`, `order_items`, `order_item_options`, `order_status_history`, `payments`, `coupon_redemptions`, plus the `order_number_seq` value) from the old database into the new one between steps 7 and 8, with ordering switched off in Settings (`accepting_orders = false`) during the copy. Follow Supabase's guide for restoring to a new project and verify row counts on both sides. Do not run the old and new databases side by side for writes.

## What I can do and what you do
- I can prepare and test everything in steps 3 to 7 once there is a new project and its keys on this machine, and run the checks in step 8.3.
- You create the project (step 1) and decide the moment of the switch (step 8). Changing Vercel settings and the database is outward-facing, so I will not do those without your say-so in chat.
