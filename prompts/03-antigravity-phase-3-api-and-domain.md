# Antigravity Prompt — Phase 3: Next.js API and Domain Modules

Implement the approved API contract and modular backend.

## Structure
Use Next.js App Router and TypeScript. Keep HTTP handlers thin. Organize domain/application/infrastructure concerns by capability where useful:
- catalog
- ordering
- customers
- promotions
- delivery
- payments
- reporting
- restaurant-settings

Do not over-abstract trivial logic. No circular dependencies.

## Tasks
1. Implement typed Supabase server/client access using current official guidance.
2. Implement authentication/session verification and server-side role/branch authorization.
3. Implement catalog and category read endpoints.
4. Implement customer address endpoints with ownership checks.
5. Implement coupon validation.
6. Implement trusted checkout with authoritative prices, options, coupon, tax and delivery calculations.
7. Make order creation and related item/payment/redemption writes atomic.
8. Add idempotency handling.
9. Implement order read/history endpoints with ownership checks.
10. Implement admin status transitions with history and transaction safety.
11. Add stable error codes, input validation, pagination and API docs.
12. Add unit and integration tests for domain rules and access control.

## Constraints
- Never trust a client-provided total.
- Never expose service-role keys.
- Never use a client-supplied user ID as proof of identity.
- Do not fake a payment gateway.
- Keep API responses compatible with `docs/api-contract.md`.
- Update docs and generated types with any approved changes.

## Acceptance test
Create an order through the documented API, verify the database records and snapshots, update its status as an authorized admin, and verify unauthorized users are rejected.

Report actual tests and limitations.
