# Security and RLS

## General
- Treat all client input as untrusted.
- Validate and authorize on the server.
- Never expose Supabase service-role or secret keys in browser bundles, Android APKs or public repository files.
- Use environment variables and platform secret storage for server credentials.
- Do not log passwords, tokens or payment secrets.

## Authentication and roles (dashboard RBAC)
- Supabase Auth holds credentials. `staff_users` holds the profile and role; `user_modules` holds module grants.
- Roles, highest first: **super_admin > manager > staff**. Only a super admin can create, edit, deactivate, delete or reset users and assign modules. Managers and staff have no user-management rights whatever modules they hold.
- Modules: overview, orders, menu, categories, customers, offers, delivery, reports, settings (each `view` or `manage`), plus the super-admin-only `users` module.
- The session cookie only proves identity. Role, status and modules are read from the database on every request, so a change, deactivation or deletion applies immediately.
- Enforcement is server-side at three points: middleware (valid session), each module's layout (`requireModule`), and every user-management action (`assertCanManageUsers`). Hiding UI controls is convenience, never the control.
- API routes added in Phase 3 must call `can(principal, module, "manage")` before any write.
- Safeguards: the last active super admin cannot be deleted, deactivated or demoted (app check plus a database trigger); nobody can delete, deactivate or demote themselves; users cannot change their own role or modules.
- Tables `staff_users`, `user_modules` and `audit_log` have RLS enabled with no policies and no grants to `anon` or `authenticated`. Only the server (service role) reads or writes them. The service-role key stays server-side.
- New accounts get a one-time temporary password and must change it at first sign-in (minimum 10 characters). Failed sign-ins are rate limited (5 per 15 minutes per email, per server instance). Sign-in failures never reveal whether the email exists or the account is deactivated.
- Known limitations: rate limiting is in-memory (use a shared store in production); there is no email delivery, so the super admin hands over temporary passwords; session cookies are not individually revocable before their 8-hour expiry, but access is re-checked against the database on each request.

## RLS expectations
- Enable RLS on exposed tables.
- Customers can read/update only their own allowed profile/address records.
- Customers can read only their own orders and order-item details.
- Customers cannot directly set order status, trusted prices, payment success or coupon redemption.
- Catalog read access follows the published/active product policy.
- Admin access is branch-scoped where applicable and validated server-side.
- History and payment records have restrictive write policies.
- Test policies using representative customer, admin, unauthenticated and cross-customer contexts.

## Trusted checkout
Checkout must validate price, product availability, options, coupons, delivery rules and totals on the server. Use an atomic transaction/database function for related writes and enforce idempotency.

## Realtime
Realtime subscriptions must not reveal other customers' orders. Test authorization and publication configuration; do not assume a client-side filter secures a subscription.

## Demo payments
Do not collect card numbers or claim real payment processing. Simulated payment records must be clearly marked as demo. Real gateway integration requires verified webhooks and provider-specific security review.
