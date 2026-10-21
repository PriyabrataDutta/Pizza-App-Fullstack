# System Architecture

## Architecture style
Use a modular monolith. Next.js hosts the admin dashboard and trusted REST API. Supabase provides PostgreSQL, Auth, Storage and Realtime. Android is a native client.

## Logical flow
Android customer app -> Next.js REST API -> application/domain modules -> Supabase PostgreSQL.

Admin dashboard -> authenticated Next.js server components/actions or Route Handlers -> application/domain modules -> Supabase.

Realtime order updates may be delivered through authorized Supabase Realtime subscriptions. Realtime is a notification mechanism, not the source of truth; clients should retrieve persisted state when needed.

## Layers
1. Presentation: Compose UI and Next.js UI.
2. API/presentation server: HTTP validation, auth/session extraction, response mapping.
3. Application: orchestrates use cases and transactions.
4. Domain: order rules, pricing policy, coupon eligibility, state transitions.
5. Infrastructure: Supabase clients, repositories, storage and external adapters.
6. Persistence: relational schema, constraints, RLS, indexes, transactional functions.

## Dependency rules
- UI depends on application-facing interfaces, not database internals.
- Domain rules do not depend on React, Compose, HTTP request types or Supabase SDK types.
- API handlers remain thin.
- Modules use documented public interfaces.
- No circular module dependencies.
- Provider-specific payment/delivery code stays behind adapters.
- Do not add layers that provide no real boundary or testability benefit.

## Suggested Next.js structure
app/
  (auth)/
  (admin)/
  api/
src/
  modules/
    catalog/
    ordering/
    customers/
    promotions/
    delivery/
    payments/
    reporting/
    restaurant-settings/
  shared/
    auth/
    database/
    errors/
    validation/
    observability/
supabase/
  migrations/
  seed.sql
docs/

Each module may contain domain/, application/, infrastructure/ and presentation/ where useful. Avoid forcing empty folders into trivial modules.

## Security boundaries
- All untrusted inputs are validated server-side.
- Admin authorization is verified server-side.
- RLS is enabled and tested for exposed tables.
- Customer data access is ownership-scoped.
- Privileged keys remain server-only.
- Checkout totals are computed from authoritative data.
- Realtime subscriptions are authorized.

## Extension strategy
Add features as modules and evolve contracts rather than rewriting the system. Loyalty, subscriptions, delivery partners and notifications are future possibilities, not initial-scope deliverables.
