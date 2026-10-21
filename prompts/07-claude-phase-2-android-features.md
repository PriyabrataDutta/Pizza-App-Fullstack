# Claude Prompt — Android Phase 2: Customer Features

Continue from the approved Android foundation. Follow `design.md` and the canonical API contract.

## Features
1. Home and promotional content.
2. Category and product listing.
3. Search/filter where supported by API.
4. Product detail screen.
5. Size/variant selection.
6. Crust and topping customization.
7. Cart with quantity and removal.
8. Coupon entry and server validation.
9. Address listing and add/edit.
10. Checkout and payment-method selection.
11. Order confirmation.
12. Order history and details.
13. Order status timeline.
14. Profile and sign out.

## Rules
- Use repositories/use cases to keep UI decoupled from data access.
- Use server-authoritative prices at checkout.
- Keep client cart totals explicitly indicative until server confirms checkout.
- Disable repeated checkout submissions and send idempotency key as documented.
- Handle validation, authentication, network and server errors.
- Clearly label simulated online payments.
- No fake GPS tracking.
- Use only authorized Realtime updates, and refresh persisted state after reconnects.
- Preserve accessibility and design tokens.

## Tests
Test cart behavior, customization state, API DTO mapping, checkout request creation, duplicate submission prevention, error states and order timeline rendering.

Build and run tests. Report features completed, actual results and backend dependencies.
