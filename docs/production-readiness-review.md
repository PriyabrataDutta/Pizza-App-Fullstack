# Production readiness review (system design, database, security, operations)

Date: 2026-10-27. Scope: backend (Next.js on Vercel), Supabase schema and storage, Android app, deployment. Method: read all five
migrations, the auth/session/rate-limit/checkout/upload code, `next.config.ts`, the Android manifest and build config; ran `npm audit`,
tests, lint, type check; probed the production URL (headers, CORS, auth, errors).

**Not verified** (the Supabase connector refused access): the live database against the migration files, Supabase plan and region,
security/performance advisors, backup settings, storage cache headers. Items that depend on these are marked "check".

## Verdict
The core design is sound: modular monolith, server-authoritative pricing, atomic idempotent checkout, snapshot orders, RLS locked down,
hashed device tokens, no known vulnerable dependencies. It is **not ready to take real orders yet**. The gaps are operational and
anti-abuse (rate limiting that does not work on serverless, no monitoring, no way for the restaurant to be alerted, one database for
test and live data, wrong server region), plus legal and tax items for Germany, plus three schema changes that are cheap now and
expensive after launch.

## 1. Blockers before real customers

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | **Rate limits do not work on Vercel.** Login lock-out (5/email, 30/IP), guest sign-up (100/h/IP), checkout (30/h/guest, 60/h/IP) and the 600/min/IP cap all live in an in-memory `Map` per server instance. Serverless runs many instances and restarts them, so each has its own counters. The code comments say so. | `shared/auth/rate-limit.ts`, `modules/checkout/rate-limit.ts` | Shared store (Upstash Redis / Vercel KV) or a Postgres counter; add Vercel Firewall rate-limit rules in front. |
| B2 | **Missed orders.** The restaurant hears about a new order only if the dashboard tab is open (poll every 8 s, chime after a first click). Browsers throttle background tabs; a closed laptop means a silent miss. | `orders-store.tsx`, no push/SMS/email/printer code | Reliable alert path: email/SMS/WhatsApp or push to a staff device, a kitchen printer, and an alarm when an order stays `placed` for N minutes. |
| B3 | **No monitoring.** 7 `console.*` calls in the backend, no error tracker, no uptime check, no request ids, no alerting. | grep | Sentry (backend + Android), an uptime monitor on `/api/menu/version`, Vercel log drain, alert on 5xx rate and on stuck orders. |
| B4 | **One database for everything.** Dev server, test scripts and production all use the same Supabase project; the live-check scripts create and delete rows there. | `.env.local` points at the live project | Separate staging project (or Supabase branch) for tests and local dev; production keys only in Vercel. |
| B5 | **Server region.** Production responses show `x-vercel-id: …::iad1` (Washington DC). Customers are in Wesel; the database region is unknown (check). Each request pays transatlantic round trips, and `place_order` makes several. | response header | Set the function region to `fra1` (or the Supabase region) in `vercel.json`; put Supabase in `eu-central-1`. |
| B6 | **Supabase plan (check).** Free projects pause after about a week without traffic and have no daily backups or point-in-time recovery. | not readable | Pro plan, daily backups, PITR add-on, a tested restore. |
| B7 | **Fake orders and coupon abuse.** Any new install is a new guest. No phone is collected, there is no block list, COD needs no verification. `WELCOME5` is limited per customer, so reinstalling the app gives a fresh welcome coupon. | `customers`, `coupons.per_customer_limit` | Require name and phone; verify phone (SMS code) or limit first-order value; `customers.is_blocked`; limit open orders per guest; tie "welcome" coupons to a verified phone or address. |
| B8 | **Demo payment in a live app.** `online_demo` / `demo_paid` exist in the UI and API, and the schema forces `is_demo = true`. A customer could believe they paid online. | `place_order`, `payments` check, Profile text | Remove the demo option for production or integrate a real provider (Stripe / PayPal) before offering online payment. |
| B9 | **Germany: legal and tax.** Not legal advice. Typically needed: Impressum, Datenschutzerklärung, AGB, "zahlungspflichtig bestellen" button, price and allergen/additive information, processing agreements with Supabase and Vercel, a retention rule for orders (bookkeeping duties versus deletion), VAT by product, receipts. Google Play also needs a privacy policy URL and the Data safety form. | n/a | Have a lawyer and a tax adviser review before launch. |
| B10 | **Release pipeline.** There is no `main` branch (`origin/HEAD` is the feature branch), no CI, and Production appears to deploy from the feature branch. | `git branch -a`, no `.github/` | `main` as the production branch, pull requests, CI (lint, `tsc`, Vitest, `next build`, Android unit tests), branch protection. |

## 2. Security review

**Good:** HTTPS with HSTS; `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; httpOnly + Secure + SameSite=Lax session cookie;
role and status read from the database on every request (deactivation takes effect at once); same-origin check on admin writes
(`origin.ts`); zod validation; 64 KB body cap; generic error messages; no CORS headers sent; guest tokens hashed (SHA-256);
service-role key only on the server and stored as a sensitive Vercel variable; `npm audit` shows 0 vulnerabilities; secrets are not in git
(`.env.example` has no values); Android: `allowBackup=false`, cleartext off, one exported activity, R8, Keystore-encrypted token.

**Fix before or soon after launch:**
- S1. Sessions are stateless (8 h): logout only deletes the cookie, and a stolen cookie works until it expires. Add a `session_version` on `staff_users` (bump on logout-everywhere, password change, deactivation), a shorter lifetime with renewal, and **MFA (TOTP)** for `super_admin` and `manager`, who can read customer data and change prices.
- S2. The only database credential is the service-role key, which bypasses RLS: one bug in any route exposes everything. Keep it server-only, rotate it after the test period, restrict database network access where possible, and over time move the API to a least-privilege database role.
- S3. Login lock-out per email lets an attacker lock a real admin out for 15 minutes. Use IP+email keys, progressive delay and alerts (after B1).
- S4. CSP is only `frame-ancestors 'none'`. Add a real CSP (nonce-based) for the dashboard.
- S5. `robots.txt` redirects (307) to the login page. Add `robots.ts` (disallow all) and `X-Robots-Tag: noindex` for the dashboard.
- S6. Password policy is 10 characters minimum, no breach check. Acceptable with MFA; no self-service reset was found, so write a recovery procedure for a locked-out super admin.
- S7. Guest tokens never expire or rotate and cannot be revoked per device (see `customer_devices` below).
- S8. Upload endpoint: signed URL, bucket limits 5 MB and jpeg/png/webp. Good. Keep SVG out. Set long cache headers on uploaded images.
- S9. Next.js 16.4.2 has a patch release (16.4.3). Update.
- S10. Review Supabase advisors (security and performance) in the dashboard.

## 3. Database design review

Normalisation is good (about 3NF) with deliberate snapshots, whole-cent money, check constraints, triggers for rules a check cannot express,
sensible `on delete` choices and an atomic `place_order`.

**Change now (one migration):**
1. `orders.contact_name`, `orders.contact_phone` (copied at checkout). Delivery needs them.
2. `customer_devices(customer_id, token_hash, created_at, last_used_at, revoked_at)` and drop `customers.token_hash`. One customer, many devices; needed for sign-in and for revoking a lost phone.
3. `customers.is_blocked`, `blocked_reason`.
4. `vat_rate` on products and `vat_rate`, `vat_minor` on `order_items` (menu prices include VAT, rates differ by item type; invoices need the split).
5. `restaurant_settings` (open/closed switch, preparation time, minimum lead time) and `opening_hours`. Checkout must refuse when closed.
6. Indexes on foreign keys that lack one: `order_items(product_id)`, `order_item_options(option_id)`, `group_attachments(default_option_id)`, `categories(default_portion_set_id)`, `orders(delivery_zone_id)`, `orders(coupon_id)`.
7. Move the demo coupons out of the migration into a seed file (they would be created in every new environment).

**Change soon:** `delivery_zone_postcodes` (postcode as primary key, so no overlaps); `orders.fulfillment_type` (delivery/pickup) with optional address;
a trigger checking `subtotal = sum(order_items.line_total)`; keep payment status in one place (`payments`) and derive the order's; an
anonymise-customer function (orders use `on delete restrict`); a separate gapless invoice number if invoices are issued (`CC-` numbers have gaps on rollback);
`statement_timeout` and `idle_in_transaction_session_timeout` for the API role.

**Not needed yet:** partitioning (about 73,000 orders a year at 200 a day), read replicas, enums instead of text+check, translations, branches.

## 4. Architecture and operations
- Serverless plus PostgREST (HTTP) means no connection-pool problem; the in-memory catalog snapshot and CDN caching are fine. Keep `catalog_meta` (single hot row) in mind for very bulk imports.
- **API versioning:** installed apps stay in use for years and the API is unversioned. Make changes additive, send an `X-App-Version` header, and add a "minimum supported version" response so an old app can be told to update.
- **Background work:** notifications, cleanup of expired guests/orphan images, daily report tables. Use Vercel Cron or `pg_cron` plus an outbox table, not request handlers.
- **Staging and rollback:** tested migration order, backups before migrations, a documented rollback (migrations are forward-only).
- **Android:** publish an AAB through Play App Signing (the keystore you hold becomes the upload key), add crash reporting, decide on certificate pinning (optional).
- **Dashboard load:** polling every 8 s per open tab is fine for a few tabs; move to Realtime broadcast later.

## 5. Planned features and what they need from the design

| Feature | Needs |
|---|---|
| Real online payments | Provider webhooks (signature + idempotency), `payment_provider_id`, refunds, relax `is_demo` check, SCA, never store card data |
| Push notifications (status, offers) | `device_push_tokens`, FCM, outbox of events |
| Sign-in and accounts | `customer_devices`, link guest to account, merge orders, email/phone verification |
| Favourites, reviews, loyalty, referral | New tables keyed by customer; reviews need a completed order |
| Combos and menu deals ("Angebot 1 · 25 €") | A bundle model with slots (pick 2 pizzas, a salad, a drink); the current catalog prices single lines only |
| Scheduled orders | `orders.scheduled_for`, capacity per slot, opening hours |
| Pickup and dine-in | `fulfillment_type`, per-mode rules, table/QR code |
| Multiple branches | `branch_id` on orders, zones, availability, staff scope, order numbering per branch |
| Drivers and live tracking | `drivers`, assignments, location events (separate retention), driver app |
| Stock / sold-out | Availability exists per size; add schedules ("not available after 21:00") |
| Multi-language | Translation tables or JSON columns per text field |
| Reporting | SQL views first, daily summary tables later; always Berlin time |

## 6. Order of work
1. B4 staging project, B10 `main` + CI, B5 region, B6 plan and backups.
2. Schema migration (section 3, "Change now"), applied to staging first, then production.
3. B1 shared rate limiting, B7 anti-abuse, B8 remove the demo payment, B2 order alerts, B3 monitoring.
4. S1 MFA and session version, S4 CSP, S5 robots, S9 Next patch.
5. B9 legal pages, privacy policy, tax review.
6. Release candidate: full end-to-end run on staging, restore test, Play Store internal testing.

## 7. Progress (2026-10-27)

Done in code and tests, **not yet applied or deployed** (needs the two new migrations on a database first, see "Deploy order"):
- B1 shared rate limiting for sign-in, guest sign-up and checkout (database counter, per-instance fallback). Catalog reads keep the in-memory limiter.
- B5 functions run in `fra1` (`backend/vercel.json`).
- B7 partly: name and phone on orders, block flag enforced at checkout and in the database. Still open: phone verification, a dashboard action to block a customer, limits per address for welcome coupons.
- B8 online (demo) payment removed from the API and the app.
- B10 CI workflow (needs a `main` branch).
- S5 robots and noindex. S9 Next.js 16.4.3.
- Schema: contact on orders, `customer_devices` (checkout signs in through it), block flag, VAT columns (not filled yet: the catalog does not read a rate), `restaurant_settings` and `opening_hours` with a working Settings screen and `GET /api/restaurant`, shared rate limiter, foreign-key indexes, order-adds-up check, `place_order` stores contact details.

Still open: B2 order alerts, B3 monitoring, B4 staging project, B6 plan and backups, B9 legal, S1 MFA and session revocation, S4 CSP, VAT rate per product in the editor and catalog, moving the demo coupons into a seed file, pickup, the remaining items in section 3 "Change soon".

### Deploy order
1. Apply `20261027100000_launch_readiness.sql`, then `20261027110000_launch_readiness_checkout.sql` (on staging first). Both are additive; code that is running now keeps working.
2. Deploy the backend. It needs both migrations (it reads `customer_devices`, `restaurant_settings` and calls `rate_limit_hit`).
3. Publish app 1.1.0 (it asks for name and phone). The server accepts older apps until `require_contact_details` is switched on in Settings, so switch it on only after most customers have updated.

### Update 2026-10-27 (evening)
Database and functions are now both in Frankfurt (see `docs/database-region-move.md`). Measured server time: reads 36 to 66 ms, placing an order about 300 ms. A launch-readiness gap closed on the way: migrations now apply to a brand-new project (tested by actually creating one). Still open from the readiness list: staging project (the Seoul project can serve as one for a while), backups and plan, order alerts, monitoring, MFA, legal pages.
