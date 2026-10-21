# Checkout and Orders: Implementation Plan (M8)

Status: **in progress (2026-10-20).** Decisions below were made by the project owner on 2026-10-20.
Builds on `docs/catalog-implementation-plan.md` (the catalog, resolver and pricing rules) and follows `docs/order-lifecycle.md`,
`docs/security-and-rls.md` and the order tables in `docs/database-schema.md`.

## Decisions

| # | Question | Decision |
|---|---|---|
| C1 | Who can place an order? | **Guest checkout with a device token.** The app asks the server for a private token the first time. Orders and addresses belong to that guest. When real sign-in exists, a guest can be linked to an account (`customers.auth_user_id`). `orders.customer_id` is never null. |
| C2 | Delivery rules | **Minimum order by area, no delivery fee.** Wesel-Mitte (postcode 46483): 10,00 €. Outer districts Blumenkamp, Schornacker, Flüren (assumed postcodes 46485 and 46487, to be confirmed by the restaurant): 20,00 €. Other postcodes are not delivered to. The free 1 l drink from 30 € is an offer, added later. |
| C3 | Payment | **Cash on delivery, or a clearly labelled demo online payment.** No real money moves and no card details are collected or stored. |
| C4 | Tax | Menu prices include VAT. No tax is added on top (`tax_minor` is 0 for now). |
| C5 | Cancellation | Only the restaurant cancels, from `accepted` or `preparing`. Customer cancellation is not in v1. |

## Principles
1. The server is the authority for every price, coupon and total. The app sends ids and quantities only.
2. One pricing path: `modules/catalog/pricing.ts` prices each line; `quote.ts` adds coupons, minimum order and totals.
3. An order is a snapshot: names, sizes, option names and prices are copied, so later menu edits never change it.
4. Checkout is atomic and idempotent: one database function writes the order, its lines, history, payment and coupon use together.
5. The device token is stored only as a hash. Customers can read only their own orders and addresses.

## Data model (migration `20261020100000_orders.sql`)
`customers` (token hash, optional name and phone, optional `auth_user_id`) · `customer_addresses` · `delivery_zones` (postcodes, minimum order, fee, estimate)
· `coupons` and `coupon_redemptions` · `orders` (status, payment, money snapshot, address snapshot, `idempotency_key`, unique per customer)
· `order_items` · `order_item_options` · `order_status_history` · `payments` (always `is_demo` while payments are simulated).
Database functions, callable only by the server: `place_order(jsonb)` (idempotent, enforces coupon limits) and `advance_order_status(...)` (valid transitions only, writes history).
All tables have RLS on with no policies and no grants to `anon` or `authenticated`.

## API
Customer (header `Authorization: Bearer <device token>`, except the first call):
`POST /api/customers/guest` · `GET/POST /api/addresses`, `PATCH/DELETE /api/addresses/{id}` · `POST /api/pricing/quote` · `POST /api/checkout` · `GET /api/orders`, `GET /api/orders/{id}`.
Admin (dashboard session, module `orders`): `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status`.

## Milestones
| # | Deliverable |
|---|---|
| M8a | Migration, tested in an in-memory Postgres (idempotency, coupon limits, transitions, money checks). Design notes here. |
| M8b | Server modules (token, quote, coupons, orders) with unit tests, and the customer and admin routes, tested against the live project. |
| M8c | Android: remote address, pricing, checkout and order repositories, device token storage, errors shown in the app; checked on the emulator. |
| M8d | Dashboard Orders screen on real orders (separate from the demo order store). |

## Progress (2026-10-20)
- **M8a done:** migration `backend/supabase/migrations/20261020100000_orders.sql` tested in an in-memory Postgres (42 checks) and **applied** to the Supabase project on 2026-10-20 (schema lint clean).
- **M8b done:** `backend/src/modules/checkout` and the customer and admin routes. 123 backend unit tests pass, and a 60-check live run against the real project passed: guest sign-up, addresses, quotes (size-dependent extras, coupons, minimums, pickup-only), checkout with idempotent retry and conflict, owner-only access, the full admin lifecycle with invalid-transition refusal, CSRF refusal and audit entries. All test data was removed afterwards.
- **M8c done (2026-10-21):** the Android app places real orders as a guest (`-Pcrust.liveOrders=true`). The device token is kept encrypted with an Android Keystore key and registered on first use; a 401 silently registers a new guest and retries once. Real address, quote, checkout and orders repositories; menu requests stay anonymous. Verified on the emulator against the live project: server-priced cart, wrong and valid coupon (WELCOME5 refused under 20 €, then applied), new address, cash on delivery, order CC-1056 in the database with the right items, discount and coupon redemption, status changes made by the restaurant shown on the tracking screen, the order still visible after an app restart, and a deleted guest recovered without an error. Test guest and order were deleted afterwards.
- **M8d done (2026-10-21):** the dashboard Orders board, order drawer and Overview now run on real orders (`modules/ordering/orders-store.tsx`). Orders load when the dashboard opens and refresh every 8 s while the tab is visible and when it comes back into view. New orders appear by themselves with an alert; Accept, Start preparing, Ready, Send out, Delivered, Reject and Cancel are saved through the admin API and recorded with the staff member's email; a click on an order that someone else already moved is refused with a clear message and the board shows the truth. Amounts are in euros and times in Berlin time. Verified in headless Chrome against the live project (18 checks, `backend/scripts/orders-ui-check.mjs`); test orders removed afterwards.
- **Known limits:** guests have no name or phone yet, so a ticket reads "Guest · street"; the board shows the latest 200 orders; the Customers, Offers, Delivery and Settings pages are still demo data; there is a chime (after the first click on the page, with an on/off switch) and the waiting count in the tab title.
- **Hardening done (2026-10-21):** see `docs/security-and-rls.md`, section "Hardening checks". The limited-user case (view-only and no orders access) is now tested live.

## Not in M8
Real payments, customer cancellation, realtime push, the free-drink offer, delivery fees, and linking guests to real accounts.
