# API assumptions (Android Phase 1)

`docs/api-contract.md` lists endpoints but not final request/response schemas, and says Antigravity must finalize them
before Android integration. Phase 1 needed DTOs to compile, so the guesses below were made. **Each one must be checked
against the final contract.** They are all isolated in `data/remote/Dtos.kt`, `data/remote/Mappers.kt` and
`data/remote/CrustApi.kt`, so fixing them does not touch the UI.

While `crust.useMockData` is true (the default) none of these affect the running app.

## Taken from the contract as written
| Item | Source |
|---|---|
| Base path `/api`, paths `categories`, `products`, `products/{id}`, `orders`, `orders/{id}` | api-contract.md |
| Query params `category`, `search`, `cursor`, `limit` on `GET /products` | api-contract.md |
| Error envelope `{ "error": { "code", "message", "details" } }` | api-contract.md |
| Status mapping 400/401/403/404/409/429/500 | api-contract.md |
| Order statuses `placed … delivered, rejected, cancelled` | order-lifecycle.md |
| Money as integer minor units + ISO currency | database-schema.md |

## Guessed (confirm or correct)
1. **List envelope.** Every list endpoint returns `{ "items": [...], "next_cursor": "..." | null }`. The contract only says
   "use one documented format consistently" and does not name it.
2. **Field names.** snake_case copied from the database column names (`category_id`, `image_url`, `dietary_type`,
   `is_spicy`, `is_bestseller`, `price_minor`, `price_delta_minor`, `selection_required`, `min_selections`,
   `max_selections`, `order_number`, `total_minor`, `created_at`). The API may use different names or camelCase.
3. **Product shape.** `variants` and `customization_groups` (with nested `options`) are embedded in each product from both
   `GET /products` and `GET /products/{id}`. The contract doesn't say where customization data comes from.
4. **`dietary_type` values.** `veg` and `non_veg` only. The schema says "constrained to supported values" without listing them.
5. **Order summary shape.** `GET /orders` items carry `id`, `order_number`, `status`, `total_minor`, `currency`, `created_at`.
   Items, price breakdown, payment state and status history (needed for order detail in Phase 2) are not modelled yet.
6. **IDs are strings** (UUIDs), as in the schema.
7. **Authentication.** Requests send `Authorization: Bearer <Supabase access token>`. The contract says to "document how
   Android sends the Supabase session/JWT" but does not. Phase 1 sends no token; sign-in is Phase 2.
8. **Pagination.** Only the first page (limit 50) is requested. Cursor paging is Phase 2.

## Consumed only through a mock server (no live schema exists)
`GET/POST /addresses`, quotes/coupon validation, and `POST /checkout` are listed in the contract without request or
response schemas. The app uses them **only in demo mode**, through `AddressRepository`, `PricingRepository` and
`CheckoutRepository`, implemented by `data/mock`. In live mode those repositories return `AppError.NotAvailable`
(`UnavailableRepositories` in `data/repository/RemoteRepositories.kt`), so nothing is invented against the real server.

What the mock "server" assumes, and the real one must confirm:
1. **Pricing rules:** tax 5% on the discounted subtotal; delivery fee Rs 39 below Rs 500, free from Rs 500. Same as the dashboard demo data.
2. **Coupons:** WELCOME100, PIZZA50, FEAST20 (20%, max Rs 200), DIWALI25 (expired). A coupon that can't apply fails with a 400-style validation error carrying a readable message.
3. **Quote request:** product ID, variant ID, option IDs and quantity per line, plus an optional coupon code. No prices.
4. **Checkout request:** the same items, address ID, payment method (`cod` or `online_demo`), coupon, instructions, and a client-generated idempotency key. Retrying the same order reuses the key; changing the order creates a new one. Retries with the same key must return the same order.
5. **Order shape:** lines (name, size, option names, quantity, line total), subtotal, discount, tax, delivery fee, total, delivery address text, payment method and an estimated-minutes value for the delivery zone.
6. **Status for tracking:** the app reads the order's persisted status and re-reads it every 8 seconds while the order is active. Realtime would replace polling.
7. **Payment methods:** only `cod` and `online_demo` exist. No card, PayPal or Google Pay, and no card data is ever collected.

## Not implemented
Sign-in and the user profile, saved cards, favourites, notifications, help and support, live map tracking, delivery partner details.
