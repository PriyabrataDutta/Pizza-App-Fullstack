# Remaining work (checked against the code on 2026-10-27)

Compared with `00-project-overview.md`, the phase prompts in `prompts/` and `prompts/08-integration-and-release-checklist.md`.
Version 1.0.0 of the Android app is built; every build type talks to the live production API by default.

## Verified today
- Backend: 148 unit tests pass (14 files); `tsc --noEmit` is clean; ESLint has 0 errors and 7 warnings (all in `scripts/*.mjs`).
- Production (Vercel): categories, products and login answer 200; orders answer 401 without a login.
- Not checked: Android unit tests and Next.js `build` (not re-run today); Supabase security and performance advisors (the connector refused access).

## A. Needed to meet the original plan

| # | Item | State in the code | Size |
|---|---|---|---|
| A1 | **Offers / coupons screen** | `/offers` is demo data (`shared/demo/fixtures`). No coupon admin API. WELCOME5, PIZZA2, FEAST10 can only be changed in the database. | M |
| A2 | **Promotions for the home banner** | DONE in code (2026-10-27): `promotions` table, `GET /api/promotions`, dashboard Offers > Home banners (picture upload, schedule, order, show/hide), app 1.2.0 shows them. Needs migration `20261027120000_promotions.sql` applied. | done |
| A3 | **Customer sign-in** | Demo sign-in only (`DemoAuthRepository`); Google sign-in not configured (`Android/docs/GOOGLE_SIGN_IN.md`). Guests are never linked to an account (`customers.auth_user_id` unused). | L |
| A4 | **Realtime** | No Supabase Realtime anywhere; both apps poll (dashboard every 8 s). The plan and checklist ask for authorized Realtime with a fallback. | M |
| A5 | **Reports + CSV export** | `/reports` is demo data. No reporting module, no export. In the dashboard prompt and the release checklist. | M |
| A6 | **Customers screen** | `/customers` is demo data. No admin API for customers. | M |
| A7 | **Delivery settings screen** | `/delivery` is demo data. Zones and minimums exist in the database (`delivery_zones`) but cannot be edited from the dashboard. | M |
| A8 | **Restaurant settings screen** | `/settings` is demo data. | S |
| A9 | **Guest name and phone** | Orders show "Guest · street". The checkout needs a name and phone (a restaurant needs them to deliver). | S |

## B. Release checklist items still open
- B1. Migrations from a clean database: tested in an in-memory Postgres during development, not re-run on a fresh Supabase project.
- B2. `supabase/seed.sql` and a documented demo-reset: seeding is done by `scripts/seed-menu.mjs`; the root `README.md` has no setup or reset steps.
- B3. Structured logs without personal data (phase 5): none added.
- B4. Backup, migration order and rollback notes (phase 5): not written.
- B5. A written list of known limitations and remaining risks (phase 5): not written.
- B6. Run the full end-to-end checklist once as a single pass (the parts were checked separately).
- B7. Android unit tests and `next build`: re-run before release.
- B8. Supabase advisors (security and performance): check in the Supabase dashboard.

## C. App gaps
- C1. Favourites, Notifications and Help & Support show "coming soon" (`ProfileScreen.kt`).
- C2. Search suggestions are hard-coded.
- C3. Payment is cash on delivery or a labelled demo payment (by design).

## D. Dashboard gaps (menu and orders)
- D1. CSV/JSON menu import, bulk hide/select.
- D2. The limited-access user case for the Menu API is tested live for orders only.
- D3. Stored pictures are not removed when an item or category is deleted or its picture replaced.
- D4. The Orders board shows the latest 200 orders only.

## E. Needs a decision or action from the project owner
- E1. Push `5350864` and `7023d0b` to GitHub (still local).
- E2. Confirm delivery postcodes 46485 and 46487 with the restaurant.
- E3. Back up `Android/keystore/crust-release.jks` and `Android/keystore.properties` (not in git, cannot be recreated).
- E4. Run `vercel logout` and delete the Vercel token created for this work.
- E5. Check the Supabase region against the Vercel function region (latency).
- E6. Rate limits are per server instance, not global; fine for a demo, not for production.
- E7. Fake cash-on-delivery orders are possible from any guest (no phone or address verification).

## F. Out of scope by design (unless approved)
Real payments, GPS tracking, customer-side cancellation, delivery fees, the free-drink offer, loyalty, subscriptions, delivery-partner apps.

## Suggested order
1. E1 push. 2. A1 + A2 (coupons and promotions). 3. A9 (guest name and phone). 4. A5 (reports). 5. A6–A8 (remaining demo pages).
6. A3 (sign-in). 7. A4 (Realtime). 8. B1–B8 and C1–C2 before a demo or release.
