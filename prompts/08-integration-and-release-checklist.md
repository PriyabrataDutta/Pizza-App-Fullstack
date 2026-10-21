# Integration and Demo Release Checklist

## Pre-demo configuration
- [ ] Supabase project and environment variables configured.
- [ ] Migrations applied in the intended environment.
- [ ] Seed data loaded.
- [ ] RLS tested.
- [ ] Admin account/role provisioned securely.
- [ ] Android API base URL points to the demo backend.
- [ ] CORS/network policies configured as needed.
- [ ] No service-role/secret key in frontend bundle or APK.
- [ ] Simulated payment clearly labelled.

## End-to-end flow
- [ ] Customer signs in.
- [ ] Customer browses products and variants.
- [ ] Customer customizes pizza.
- [ ] Cart shows item details.
- [ ] Coupon validation works.
- [ ] Checkout validates authoritative server prices.
- [ ] Duplicate submission does not create duplicate orders.
- [ ] Order and item snapshots persist.
- [ ] Admin sees the order.
- [ ] Admin can accept/reject according to allowed transitions.
- [ ] Admin can advance valid order statuses.
- [ ] Status history records actor and timestamp.
- [ ] Android displays the latest persisted status.
- [ ] Realtime reconnect/fallback works.
- [ ] Customer cannot view another customer's order.
- [ ] Customer cannot perform admin operations.
- [ ] Unauthenticated requests are rejected where required.

## Dashboard
- [ ] Product create/edit and availability work.
- [ ] Search and filters work.
- [ ] Coupon controls work.
- [ ] Reports match source data.
- [ ] CSV export works.
- [ ] Empty/loading/error states are usable.

## Build and quality
- [ ] Next.js type check passes.
- [ ] Next.js lint/tests/build pass where configured.
- [ ] Android build/tests pass.
- [ ] SQL migrations apply from a clean database.
- [ ] No known critical security defect remains.
- [ ] README includes setup and demo reset steps.
- [ ] Known limitations are disclosed.

## Demo script
1. Open Android and select a pizza.
2. Choose size, crust and toppings.
3. Add a side and proceed to checkout.
4. Place a demo order.
5. Open admin dashboard and show the order.
6. Accept it and update the status.
7. Return to Android and show the updated order.
8. Complete the order and show the final state.

Do not claim real payments, GPS tracking or production readiness unless those capabilities have been implemented and verified.
