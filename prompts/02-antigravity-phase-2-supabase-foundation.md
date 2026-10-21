# Antigravity Prompt — Phase 2: Supabase Database Foundation

Implement the approved schema from `docs/database-schema.md`. Do not redesign it independently.

## Tasks
1. Create numbered SQL migrations under `supabase/migrations/`.
2. Create required tables, primary/foreign keys, check constraints, unique constraints and indexes.
3. Configure RLS and policies according to `docs/security-and-rls.md`.
4. Create a repeatable `supabase/seed.sql` with at least 15 products, 5 categories, variants, customization options, demo coupons and representative orders.
5. Add generated or maintained TypeScript database types.
6. Document local setup, environment variables, migration and seed commands.
7. Test migrations from a clean local database if Supabase CLI/local services are available.
8. Test RLS with customer, admin, unauthenticated and cross-customer cases.

## Required checks
- No client-accessible service-role secret.
- Customer ownership enforced.
- Role changes restricted.
- Order totals are not writable by customers.
- Status history cannot be arbitrarily edited by clients.
- Coupon limits can be enforced safely under concurrent checkout.
- Seed script is repeatable or explicitly documents its reset behavior.

## Deliverables
Report migration files, schema decisions, test commands/results, remaining security gaps and exact setup steps. Do not begin full dashboard feature development until the foundation is reviewed.
