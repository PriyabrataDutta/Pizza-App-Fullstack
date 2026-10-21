# Dynamic Catalog: Implementation Plan

Status: **approved (2026-10-19), with the defaults in section 1.** Progress: M0 done. M1: migration `backend/supabase/migrations/20261019100000_catalog.sql` was tested in an in-memory Postgres (30 checks passed) and **applied to the Supabase project on 2026-10-19** (schema lint: no errors). M1 is done. **M2 is done (2026-10-19):** `backend/src/modules/catalog` holds the pure resolver and pricing rules, the Supabase repository, the service and the five public endpoints; 39 backend tests pass and the endpoints answer correctly against the live (still empty) database. Admin-side validation will use zod, added in M4. **M3 is done (2026-10-19):** `backend/scripts/seed-menu.mjs` and `scripts/seed/niki-menu.json` loaded the Niki menu into the live database (15 categories, 188 products, 342 portions, 10 groups, 66 options, 62 attachments, 224 price rows); a second run changed nothing. The public API returns it correctly (Salami toppings 0,50 / 1,00 / 2,50 €, sheet pizza flat 2,50 €, pasta default per dish, pickup-only alcohol). Run the seed with `node --env-file=.env.local scripts/seed-menu.mjs` (dry run) or `--apply`. **M7 is done (2026-10-19):** the Android app reads the live menu (`-Pcrust.liveCatalog=true`), with per-portion extra prices, server defaults, `needs_choices`, an HTTP cache with offline fallback, and the demo server pricing live products; checked on the emulator (categories, Salami toppings by size, Bolognese defaults, cart, an order placed for 24,00 €, offline relaunch); 118 Android tests pass. Not yet done in the app: the menu-version check and category images. **M4 is done (2026-10-19):** the admin API (categories, products, portions, availability, duplicate, preview, option groups and options, attachments with price grids, image uploads) in `backend/src/modules/catalog/admin`, documented in `docs/api-contract.md`; 59 backend tests pass, and 47 live checks against the real project passed (the test data it created was removed). Still open from M4: the CSV/JSON import (it moves to M6 with its screen) and a live test of a user with limited modules. **M5 is done (2026-10-19):** the Categories screen (`/categories`) now works on the real database: list with product counts and thumbnails, sub-categories, drag or arrow reordering, show/hide switch, create from a template (size template and the choice/extra groups every item gets), edit, picture upload straight from the browser, and delete for empty categories. It lives in `backend/src/modules/catalog` (`categories-view.tsx`, `category-form.tsx`, `image-field.tsx`, `admin-client.ts`, `categories-tree.ts`), plus a new `GET /api/admin/portion-sets`. 67 backend tests pass; 21 browser checks passed in headless Chrome against the live project (test data removed). Not done: removing a category's stored picture when it is deleted or replaced (the file stays in storage). **M6 is mostly done (2026-10-20):** the Menu screen (`/menu`) is live on the real database. Items tab: search, category and shown/hidden filters, paging, quick show/hide, copy (starts hidden), and a card layout on phones. Item editor: details, picture, sizes and prices in euros (new items from a category use the template's size keys so they inherit category prices), and per-item choices and extras with a price grid by size, "customize for this item", and defaults. Choices and extras tab: create, edit and delete shared groups and their options. The category form also sets category-wide prices by size. 88 backend tests pass; 31 browser checks passed in headless Chrome against the live project (test data removed). **Not built yet:** CSV/JSON import, bulk hide/select, a live test with a limited-access user, and removing stored pictures when an item or category is deleted or its picture replaced. The dashboard's other pages (orders, overview) still use demo data and rupee formatting. Next: M8 (real checkout and orders), then M9 (hardening).
Goal: categories, products, portions, extras and choices live in the database and are edited in the dashboard. The Android app shows whatever is there. Adding a new category, product or extra needs **no code change and no app update**.

Source of truth for the first data set: the printed menu of Steinofen Pizzeria Niki (Wesel), currently in `Android/.../data/mock/MockMenu.kt` (188 products, 15 categories, EUR).

## 1. Decisions and defaults

Questions that were asked and not yet answered are given a default here. Change any of them before milestone M1.

| # | Question | Default used in this plan |
|---|---|---|
| D1 | Which ingredients can be added as an extra topping? | The ingredients that appear on the menu (about 30). The restaurant confirms the list. |
| D2 | Can a customer remove included ingredients? | Not in v1. Included ingredients are shown as text. |
| D3 | Do extras apply to Pizza Specials and Calzone? | Pizza and Pizza Specials yes (0,50 / 1,00 / 2,50 €). Calzone no. Pizzablech has its own flat 2,50 € price. |
| D4 | Sub-categories now or later? | Table supports a parent, UI shows one level in v1. |
| D5 | Bundles (Angebot 1 and 2) orderable? | No. They stay as banners and offers rules. Schema leaves room (section 12). |
| D6 | Photos | Upload in the dashboard to Supabase Storage. Generated images are uploaded the same way. |
| D7 | Languages | One language per item. Translations table is a later, additive change. |
| D8 | Allergen codes | Stored as a list of codes per product and shown in the app. |

## 2. Principles

1. A category is a container. Nothing in code looks at a category's name.
2. Everything that varies is data: portions, extras, choices, prices, filters, images.
3. Three kinds of customer decisions, kept apart: **portion** (the priced base: Klein, Groß, Maxi, 0,33 l), **extra** (optional, adds money: topping, cheese bake, aioli) and **choice** (free: pasta shape, dressing, pork or turkey).
4. The server resolves everything. The app displays the result and never contains pricing rules. Checkout re-validates and prices from the same resolver.
5. Hide, never delete. Orders keep a snapshot of names, portions and prices.
6. Money is integer cents plus a currency code. No floating point.
7. Forward compatible: the app ignores unknown fields; the API carries a catalog version.

## 3. Data model

All tables get `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at` unless stated. RLS is enabled on all of them with **no public policies**: every read and write goes through the Next.js server (service role), the same approach as the access tables.

### 3.1 Structure

| Table | Key columns and rules |
|---|---|
| `categories` | `parent_id` null or categories(id) (max depth 2), `slug` unique, `name`, `description`, `image_path`, `icon_key` (a name from a fixed list the app knows, optional), `sort_order`, `is_active`, `default_portion_set_id`. |
| `portion_sets` | Reusable templates such as "Pizza sizes" or "Drink sizes": `name`. |
| `portion_set_items` | `set_id`, `key` (stable code: `klein`, `gross`, `maxi`, `0_33l`, `1_0l`, `standard`), `label`, `sort_order`. Unique `(set_id, key)`. |
| `products` | `category_id`, `slug` unique, `name`, `description`, `image_path`, `diet` (`veg` / `non_veg`), `is_spicy`, `is_bestseller`, `is_new`, `allergens text[]`, `fulfillment` (`delivery_and_pickup` / `pickup_only`), `sort_order`, `is_active`. |
| `product_portions` | `product_id`, `key`, `label`, `price_minor bigint >= 0`, `currency char(3)`, `sku`, `is_available`, `sort_order`. Unique `(product_id, key)`. At least one row per active product. |
| `tags`, `product_tags` | Extra filters that need no app update (`vegan`, `gluten_free`): `tags(key unique, label)`. Diet and spicy stay as columns because every product has them. |

### 3.2 Extras and choices

| Table | Key columns and rules |
|---|---|
| `option_groups` | `name`, `kind` (`extra` / `choice`), `min_select`, `max_select`, `is_required`, `is_active`. Check: `0 <= min <= max`; a `choice` group has `min >= 1` when required and no prices. |
| `options` | `group_id`, `name`, `default_price_minor` (extras only), `sort_order`, `is_active`. The ingredient "Salami" exists once and is reused. |
| `group_attachments` | Where a group applies. `scope` (`category` / `product`), exactly one of `category_id` / `product_id` (check constraint), `group_id`, `sort_order`, `default_option_id` (for example Rigatoni for one pasta dish). Unique per scope and group. |
| `option_prices` | `attachment_id`, `option_id`, `portion_key` (null means any portion), `price_minor`. Unique `(attachment_id, option_id, coalesce(portion_key,'*'))`. |

**Price resolution for an extra** (first match wins):
1. `option_prices` row on a **product** attachment for the chosen `portion_key`,
2. the same on a **product** attachment with `portion_key` null,
3. the same two lookups on the **category** attachment,
4. `options.default_price_minor`.

A product attachment for a group **overrides** the category attachment for that same group (it does not add a second copy).

### 3.3 Support tables

- `catalog_meta(version bigint)`: one row; a trigger increments it on any catalog change. Drives caching (section 5).
- `audit_log`: reuse the existing table. New actions: `category_*`, `product_*`, `group_*`, `price_*`, `image_uploaded`, `catalog_imported`.
- Storage bucket `product-images`: public read, writes only through signed upload URLs created by the server for users with the right module.
- Orders (needed by M7): `orders`, `order_lines` (snapshots `product_name`, `portion_label`, `unit_price_minor`), `order_line_options` (snapshots `group_name`, `option_name`, `price_minor`). No foreign key from snapshot text to live catalog rows beyond optional ids.

### 3.4 Example: how the Niki menu maps

| Menu item | Rows |
|---|---|
| Pizza 1 to 66 | Category "Pizza", portion set "Pizza sizes" (klein, gross, maxi), one product each. |
| "Jede weitere Zutat" | Group "Extra Zutaten" (kind extra, 0 to 6) with about 30 ingredient options. Attached to category Pizza (and Pizza Specials) with a price grid: klein 0,50, gross 1,00, maxi 2,50. |
| Pizzablech 28 € | Group "Zutaten (2 nach Wahl)" (kind choice, min 2, max 2) on that product. Group "Extra Zutaten" attached to the product with a flat grid of 2,50. |
| Nudeln | Category-level choice group "Nudelsorte" and extra group "Überbacken" (+1,00 flat). Each dish's attachment sets its own `default_option_id`. |
| Indian dishes | Category-level choice "Beilage" and extra "Extra Basmati-Reis" (+2,00). |
| Pizzabrötchen | Extra group "Dip" (Kräuterbutter, Aioli, +1,00 each). |
| Alcohol | `fulfillment = pickup_only`; not orderable in the delivery app. |

## 4. Backend structure (`backend/src/modules/catalog`)

```
schema.ts        zod schemas for every request and response (single source for validation and types)
repository.ts    all SQL/Supabase access, no business rules
resolver.ts      resolveProduct(product) -> portions, effective groups, defaults, price grids
pricing.ts       priceLine({product, portionKey, selections}) and validateSelection(); used by catalog API AND checkout
service.ts       use cases (create category, reorder, attach group, import) with audit logging
routes           thin handlers: auth, permission check, call service, map errors
*.test.ts        resolver precedence, validation, pricing
```

`resolver.ts` and `pricing.ts` are pure functions with no database access, so they are fast to test and shared by the catalog and checkout.

## 5. API

Follows `docs/api-contract.md` (base `/api`, error envelope, cursor pagination).

### Customer (no login required for reading)
| Endpoint | Notes |
|---|---|
| `GET /api/menu/version` | `{ "version": 42 }`. Cheap check for the app. |
| `GET /api/categories` | Active categories in `sort_order`, with `parent_id`, `image_url`, `icon_key`. |
| `GET /api/products?category=&search=&tag=&diet=&cursor=&limit=` | Active products, 1 portion price range, tags, diet, flags. `limit` default 30, max 100. |
| `GET /api/products/{id}` | **Fully resolved** product (below). |
| `GET /api/filters` | The tags and diet values the app shows as filter chips. |

All GET responses carry `ETag` and `Cache-Control: public, max-age=60, stale-while-revalidate=300`; the app sends `If-None-Match` and gets `304` when nothing changed.

Resolved product (shape; values from the Niki menu):
```json
{
  "id": "…", "name": "Salami", "description": "mit Salami", "diet": "non_veg",
  "image_url": null, "currency": "EUR",
  "portions": [
    {"key":"klein","label":"Klein 28 cm","price_minor":700,"available":true},
    {"key":"gross","label":"Groß 32 cm","price_minor":900,"available":true},
    {"key":"maxi","label":"Maxi 45 cm","price_minor":1900,"available":true}
  ],
  "groups": [{
    "id":"…","name":"Extra Zutaten","kind":"extra","min":0,"max":6,"required":false,
    "options":[{"id":"…","name":"Champignons",
      "prices":{"klein":50,"gross":100,"maxi":250}}]
  }]
}
```
Prices for each option are sent **per portion key**, already resolved, so the app only looks up the selected portion.

### Admin (role and module checked on the server; every change audited)
| Area | Endpoints | Module |
|---|---|---|
| Categories | `GET/POST /api/admin/categories`, `PATCH/DELETE …/{id}`, `POST …/reorder` | `categories` (manage to write) |
| Products | `GET/POST /api/admin/products`, `PATCH …/{id}`, `POST …/{id}/duplicate`, `PATCH …/{id}/availability` | `menu` |
| Portions | `PUT /api/admin/products/{id}/portions` | `menu` |
| Option groups | `GET/POST /api/admin/option-groups`, `PATCH …/{id}`, options CRUD | `menu` |
| Attachments and prices | `PUT /api/admin/attachments` (scope, group, default option, price grid) | `menu` |
| Images | `POST /api/admin/uploads` returns a signed upload URL | `menu` or `categories` |
| Import | `POST /api/admin/import/preview`, `POST …/commit` (CSV or JSON) | `menu` (manage) |

Rules enforced on the server: unique slugs; price at least 0 and whole cents; at least one available portion on an active product; `min <= max`; category depth at most 2; `DELETE` on a category or product is refused when it has children or orders, with a message to hide it instead; a hidden category hides its products from customers.

Error codes added: `CATEGORY_NOT_EMPTY`, `SLUG_TAKEN`, `PRICE_INVALID`, `GROUP_RULE_INVALID`, `IMAGE_TOO_LARGE`.

## 6. Dashboard (Next.js)

Replaces the demo data in `shared/demo/fixtures.ts` for these pages.

| Screen | Contents |
|---|---|
| **Categories** (`/categories`) | List with drag to reorder, show/hide switch, image upload, product count, **"New category" with templates** (pick a portion set and groups, so a new category such as Burger is ready in one step). |
| **Menu** (`/menu`) | Table with search, category and diet filters, quick "sold out" switch per portion, bulk hide, duplicate. |
| **Product editor** | Tabs: Basics (name, description, category, diet, spicy, new, bestseller, allergens, fulfillment), Portions and prices, Extras and choices (attach groups, set defaults, price grid), Image, and **Preview as customer** (the app's product screen). |
| **Option library** | Create and edit groups and options once, see where each is used before changing it. |
| **Price grid editor** | Rows are options, columns are portions. Set it once on the category, override per product; shows which value is inherited. |
| **Import** | CSV or JSON upload, a preview of what will be created and changed, then commit. |

Access: unchanged RBAC (`categories` and `menu` modules, view or manage). Viewers see read-only screens.

## 7. Seed and import

1. A script `backend/scripts/seed-menu.ts` reads one JSON file generated from the existing Niki data (`MockMenu.kt` generator) and creates portion sets, groups, options, attachments, price grids, categories and products. It is **idempotent** (matches by slug).
2. Acceptance: after seeding, the database holds 15 categories and 188 products (70 with three portions, 14 with two, 104 with one), and the resolved Salami product matches the example in section 5.
3. Values read with doubt from the photo (Hawaii and Mediterrane larger sizes, item 107's description, number 140, price of 151) are flagged in the JSON and confirmed with the restaurant before go-live.

## 8. Android changes

| Area | Change |
|---|---|
| Domain | `Variant` becomes `Portion` with a `key`. `CustomizationGroup` gets `kind`. `CustomizationOption` gets `priceByPortion: Map<String, Money>`. `SelectionRules.unitPrice` takes the chosen portion. Defaults come from `default_option_id`. |
| Data | DTOs for the new resolved product; `ignoreUnknownKeys` stays on; mappers and tests with sample JSON captured from the real API. |
| Repositories | Real `RemoteCatalogRepository` becomes the default when `crust.useMockData=false`. The mock repositories are regenerated from the same model so unit tests keep working. |
| UI | The extra's price chip updates when the customer changes portion. Categories come from the server; the name-based art lookup is replaced by `image_url`, then `icon_key`, then a neutral placeholder. Filter chips come from `/api/filters`. |
| Performance | Coil for photos with a placeholder and crossfade. The last catalog response is cached on disk and revalidated with the ETag, so the Menu opens instantly and works offline. Product list loads page by page. |
| Cart | Cart lines store the portion key and option ids; at checkout the server re-prices and validates. |

## 9. Checkout dependency (separate milestone, same resolver)

Orders are not real until `POST /api/pricing/quote` and `POST /api/checkout` exist and use `pricing.ts`:
server loads the product, validates portion and selections (required groups, min and max, option belongs to an attached group, portion available, not `pickup_only`), prices with the resolution order in 3.2, applies coupons and offer rules, writes the order and snapshots in one transaction, and honours the idempotency key. The app keeps sending only ids and quantities.

## 10. Testing

| Level | What |
|---|---|
| Unit (backend) | Resolver precedence (product over category, portion over any), selection validation, price lines for pizza, Pizzablech, pasta, drinks. |
| Database | Constraint tests on a local Supabase: attachment scope check, duplicate prices, cascading rules, version trigger. |
| API | Permission matrix (each role and module), error codes, ETag and 304 behaviour, pagination. |
| Dashboard | End to end (Playwright): create a category from a template, add a product, set a price grid, hide it, see it disappear from the API. |
| Android | Unit tests for mapping and pricing against captured JSON; one emulator run against the local server. |
| Acceptance | Add a category and product in the dashboard and see them in the app **without rebuilding the app**; change a topping price and see the new price in the cart. |

Targets: menu list under 300 ms at the 95th percentile on the demo data, product detail under 150 ms, first product page under 40 KB.

## 11. Milestones

Estimates are rough working days for one developer and include tests.

| # | Milestone | Deliverable | Depends on | Days |
|---|---|---|---|---|
| M0 | Approve the plan, answer D1 to D8 | Signed-off decisions | none | 0.5 |
| M1 | Database | Migration (all tables, checks, trigger, bucket), reviewed by you **before** it is applied through the linked CLI | M0 | 1.5 |
| M2 | Resolver, pricing and public API | `resolver.ts`, `pricing.ts`, the five customer endpoints, ETag, tests | M1 | 3 |
| M3 | Seed | `seed-menu.ts`, Niki data in the database, count checks | M1, M2 | 1 |
| M4 | Admin API | All admin endpoints, validation, audit, image upload | M2 | 3 |
| M5 | Dashboard: categories | Screen, templates, reorder, image | M4 | 2 |
| M6 | Dashboard: menu and editor | Menu table, product editor, option library, price grid, import | M4, M5 | 5 |
| M7 | Android | New models, remote repositories, UI changes, offline cache | M2, M3 | 4 |
| M8 | Checkout and orders | Quote and checkout endpoints, snapshots, app wiring | M2, M7 | 4 |
| M9 | Hardening | Performance pass, permission tests, images for products, docs update, rollback notes | all | 2 |

Total about 26 working days. A usable slice (read-only app on the live database) is reached after M3 and M7, about 10 days in.

## 12. Later (kept possible by the design)

- **Bundles** such as Angebot 1 and 2: a group whose options point to other products and portions (`options.linked_product_id`), priced by a bundle rule.
- **Price rules and offers**: company price (all large pizzas 9,00 €) and "free 1 l drink from 30 €" belong to the offers module, evaluated at quote time.
- **Time-based availability** (lunch menu): optional schedule on category or product.
- **Translations**: a `translations` table keyed by entity and language.
- **Multiple branches**: `branch_id` on products or a branch availability table.
- **Removing included ingredients**.

## 13. Risks and how they are handled

| Risk | Handling |
|---|---|
| Wrong data model is expensive once orders exist | Review the migration and the resolved JSON with you first; only additive migrations afterwards. |
| Price rules drift between catalog and checkout | One shared `pricing.ts`, tested once. |
| Dashboard edits break old orders | Hide-only, snapshots in order tables. |
| Photos make the menu slow | Compressed images, Coil caching, lists load thumbnails. |
| Photographed menu has transcription errors | Doubtful values flagged in the seed, confirmed by the restaurant before go-live. |
| Supabase connector in the assistant is signed in to another account | All schema changes go through the linked CLI and migration files. |
| Secrets | Service-role key stays server-side. `backend/.env.local` must not contain passwords in comments. |

## 14. Definition of done

- Everything in M1 to M9 merged, migrations applied, tests green.
- A new category, product, extra and price grid created in the dashboard show correctly in the app with no rebuild.
- Orders placed from the app are priced and validated by the server and stored with snapshots.
- `docs/database-schema.md` and `docs/api-contract.md` updated to match what was built.
