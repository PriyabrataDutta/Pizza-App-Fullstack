# API Contract — Initial Proposal

The backend owner must finalize this contract before Android integration. If OpenAPI is used, keep the specification version-controlled and use it to validate requests/responses where practical.

## Conventions
- Base path: `/api`.
- JSON request/response bodies.
- ISO 8601 timestamps with timezone.
- Consistent error envelope:
  `{ "error": { "code": "VALIDATION_ERROR", "message": "Readable message", "details": [] } }`
- Use correct HTTP statuses: 400 validation, 401 unauthenticated, 403 forbidden, 404 missing resource, 409 conflict/idempotency conflict, 429 rate limited, 500 unexpected error.
- Paginated list responses should use one documented format consistently.
- Never expose internal stack traces or secrets.

## Public/customer endpoints
- `GET /api/categories`
- `GET /api/products?category=&search=&cursor=&limit=`
- `GET /api/products/{id}`
- `POST /api/coupons/validate`
- `GET /api/addresses`
- `POST /api/addresses`
- `PATCH /api/addresses/{id}`
- `DELETE /api/addresses/{id}`
- `POST /api/checkout`
- `GET /api/orders`
- `GET /api/orders/{id}`

### Catalog read endpoints (implemented)
Public, no login. Code: `backend/src/modules/catalog`. Plan: `docs/catalog-implementation-plan.md`.

| Endpoint | Result |
|---|---|
| `GET /api/menu/version` | `{ "version": n }`. Never cached. The app refetches the menu only when it changed. |
| `GET /api/categories` | `{ "items": [{ id, parent_id, slug, name, description, image_url, icon_key, sort_order }] }`. Active categories only; a hidden parent hides its sub-categories. |
| `GET /api/products?category=&search=&tag=&diet=&spicy=&bestseller=&cursor=&limit=` | `{ "items": [...], "next_cursor": string or null }`. `category` is an id or slug and includes sub-categories; `search` matches name, description and category name; `diet` is `veg` or `non_veg`; `limit` 1 to 200 (default 30); `cursor` is opaque. Categories and products carry `image_url` (full picture) and `thumb_url` (480 px copy, about 35 KB, for lists and cards). Each item has `portions`, `available` and `needs_choices` (true when a required choice must be made before adding). |
| `GET /api/products/{id}` | One product, fully resolved: `portions`, and `groups` of extras and choices with `prices` per portion key already resolved (product price, then category price, then the option's default). |
| `GET /api/filters` | `{ diet, flags, tags }`: the filter chips the app shows. |

**How the server answers these quickly:** the whole menu is read from Supabase once, in one parallel round trip, and kept in server memory (`backend/src/modules/catalog/snapshot.ts`). Every read (lists, search, filters, product detail) is answered from memory. The only database call is a tiny check of `catalog_meta.version`, at most once every 3 seconds, and the menu is reloaded only when that version changes (every dashboard edit bumps it). If Supabase cannot be reached the last copy keeps being served. Checkout re-checks the version just before pricing, so an order never uses a price older than half a second.

All of these send `ETag` and `Cache-Control: public, max-age=30, stale-while-revalidate=300`, answer `304` to a matching `If-None-Match`, and use the error envelope above (`VALIDATION_ERROR` 400, `PRODUCT_NOT_FOUND` 404).

### Catalog admin endpoints (implemented)
For the dashboard. Same-site, cookie-authenticated (the dashboard session). Every call re-reads the user from the database: **401** when signed out, **403** when the module is not allowed (`categories` for categories, `menu` for products, groups, prices and images; `view` to read, `manage` to change), **403 `CROSS_SITE`** for a mutation sent from another site. All changes are written to the audit log. Bodies are JSON, snake_case, money in whole cents. Code: `backend/src/modules/catalog/admin`.

| Endpoint | What it does |
|---|---|
| `GET /api/admin/categories` | All categories including hidden ones, with `product_count`. |
| `POST /api/admin/categories` | Create. Slug is made from the name (German letters spelled out) unless given. |
| `PATCH /api/admin/categories/{id}` | Change only the fields sent. |
| `DELETE /api/admin/categories/{id}` | Only an empty category (no products, no sub-categories); otherwise `409 CATEGORY_NOT_EMPTY`. Hide it instead. |
| `POST /api/admin/categories/reorder` | `{ "ids": [...] }` in the new order; siblings only. |
| `GET /api/admin/portion-sets` | The size templates ("Pizza sizes", "Drink sizes", ...) with their sizes. |
| `GET /api/admin/products?category=&search=&active=&offset=&limit=` | Includes hidden products. |
| `POST /api/admin/products` | Create with `portions` (at least one) and optional `tag_keys`. |
| `GET /api/admin/products/{id}` | Editor view: product, portions, tags, its own group attachments with prices, and those inherited from the category. |
| `PATCH /api/admin/products/{id}` | Change only the fields sent; `portions`, when sent, replaces the whole list. |
| `PATCH /api/admin/products/{id}/availability` | `{ "is_active": false }` hides it; `{ "portion_key": "gross", "is_available": false }` marks one size sold out. |
| `POST /api/admin/products/{id}/duplicate` | A copy that starts hidden. |
| `GET /api/admin/products/{id}/preview` | The product as the app receives it, even while hidden. |
| `GET/POST /api/admin/option-groups`, `GET/PATCH/DELETE …/{id}` | Groups of extras and choices. `kind` cannot change after creation. Delete only when not used anywhere (`409 IN_USE`). |
| `PUT /api/admin/option-groups/{id}/options` | Replaces the option list (ids kept, new created, omitted removed). A free `choice` group refuses prices (`400 CHOICE_PRICE`). |
| `GET /api/admin/attachments?scope=&target_id=` | The groups that apply to one category or product, with prices. |
| `PUT /api/admin/attachments` | Attach a group to a category or product, set its default option, and optionally replace its price grid: `prices: [{ option_id, portion_key or null, price_minor }]`. |
| `DELETE /api/admin/attachments/{id}` | Remove it. |
| `POST /api/admin/uploads` | `{ "kind": "product" \| "category", "content_type": "image/jpeg" \| "image/png" \| "image/webp" }` returns a signed `upload_url` and `token`; the browser uploads the file to storage (max 5 MB), then saves the returned `path` as `image_path`. |

Errors use the envelope above. Codes added: `UNAUTHENTICATED`, `FORBIDDEN`, `CROSS_SITE`, `PASSWORD_CHANGE_REQUIRED`, `NOT_FOUND`, `SLUG_TAKEN`, `CATEGORY_NOT_EMPTY`, `CATEGORY_DEPTH`, `DUPLICATE`, `IN_USE`, `GROUP_RULE_INVALID`, `CHOICE_PRICE`, `OPTION_NOT_IN_GROUP`, `KIND_LOCKED`.
Products are never deleted, only hidden, because old orders refer to them.

### Customer endpoints: guests, addresses, quote, checkout, orders (implemented)
Code: `backend/src/modules/checkout`. The app first calls `POST /api/customers/guest` (201, rate limited per network) and keeps the returned `token` (`cc1_…`, shown once; only its hash is stored). Every other call sends `Authorization: Bearer <token>`; a missing or unknown token is `401 UNAUTHENTICATED`. Responses are never cached. Money is whole cents (EUR).

| Endpoint | What it does |
|---|---|
| `POST /api/customers/guest` | `{ customer_id, token }`. |
| `GET/POST /api/addresses` | List (default first) / create (`label, line1, locality, city, postal_code` 5 digits, optional `instructions`, `is_default`). The first address is the default. Max 10. |
| `PATCH/DELETE /api/addresses/{id}` | Change only what is sent / remove (another address becomes the default). Other guests get `404`. Old orders keep their own address copy. |
| `POST /api/pricing/quote` | `{ items: [{ product_id, portion_key, option_ids, quantity }], coupon_code?, address_id? }`. Returns lines, `subtotal_minor`, `discount_minor`, `total_minor` and, with an address, `delivery` (`minimum_order_minor`, `meets_minimum`, `estimated_minutes`). Any price sent by the client is ignored. |
| `POST /api/checkout` | Quote body plus `idempotency_key`, `address_id`, `payment_method` (`cod` or `online_demo`, which is simulated and always labelled so), optional `instructions`. Returns the order (`201`). The same key with the same cart returns the same order; with a different cart `409 IDEMPOTENCY_CONFLICT`. |
| `GET /api/orders`, `GET /api/orders/{id}` | The guest's own orders, newest first, with lines, chosen options, address copy, payment state and status history. |

Error codes: `COUPON_INVALID`, `COUPON_MINIMUM` (message says how much more to add), `ITEM_UNAVAILABLE`, `PICKUP_ONLY`, `NOT_DELIVERED` (422, postcode not served), `MINIMUM_ORDER` (400, `details[0].short_by_minor`), `EMPTY_CART`, `IDEMPOTENCY_CONFLICT`, `ORDER_NOT_FOUND`, `RATE_LIMITED` (429).
Delivery rules: no delivery fee; minimum order by area (46483: 10,00 €; 46485 and 46487: 20,00 €; other postcodes are not delivered). Menu prices include VAT.

### Order admin endpoints (implemented)
Dashboard session, module `orders`. `GET /api/admin/orders?status=a,b&offset=&limit=` (newest first), `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status` with `{ status, reason? }`. Lifecycle: placed → accepted or rejected; accepted → preparing or cancelled; preparing → ready_for_dispatch or cancelled; ready_for_dispatch → out_for_delivery → delivered. Any other move is `409 INVALID_TRANSITION`. Cash orders become `paid` on delivery. Each change writes history and an audit entry.

## Admin endpoints (proposed, not yet built)
- `POST /api/admin/products`
- `PATCH /api/admin/products/{id}`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/{id}`
- `POST /api/admin/coupons`
- `PATCH /api/admin/coupons/{id}`
- `GET /api/admin/reports/sales`
- `GET /api/admin/reports/products`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`

These are proposed endpoints; implement only after documenting the final request/response schemas and auth requirements.

## Checkout request (conceptual)
Include:
- client-generated idempotency key
- selected delivery address ID
- payment method
- coupon code if any
- items containing product ID, variant ID, customization option IDs and quantities
- delivery instructions if supported

Do not send a trusted total as input. The server calculates all monetary values.

## Checkout response (conceptual)
Include:
- order ID
- display order number
- persisted status
- currency
- item/price summary
- authoritative total
- payment state
- created timestamp

## Order status update
The admin request includes the target status and optional reason. The server verifies role, branch scope and valid transition, persists status plus history atomically, and returns the persisted order state.

## Authentication
Document how Android sends the Supabase session/JWT to Next.js and how Next.js verifies it. Do not trust a user ID supplied in the request body as identity. Admin authorization must be checked server-side.

## Contract ownership
Antigravity owns the canonical API specification. Claude must consume it. Any change updates docs, implementation, generated types if applicable, tests and integration notes.
