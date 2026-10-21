# Crust & Co. Pizza House — Implementation Kit

This kit contains the phased prompts and architecture documents for building:
- Android customer app with Claude: Kotlin + Jetpack Compose
- Admin dashboard and backend with Google Antigravity: Next.js + TypeScript
- Shared backend infrastructure: Supabase PostgreSQL, Auth, Storage and Realtime

## Start here

1. Read `00-project-overview.md`.
2. Give Antigravity `prompts/01-antigravity-phase-1-architecture.md`.
3. Review and approve its architecture documents before implementation.
4. Give Antigravity `prompts/02-antigravity-phase-2-supabase-foundation.md`.
5. Verify migrations, RLS and seed data.
6. Give Antigravity `prompts/03-antigravity-phase-3-api-and-domain.md`.
7. Once the API contract is stable, give Claude `prompts/06-claude-phase-1-android-foundation.md`.
8. Continue phase by phase using the prompts in `prompts/`.
9. Use `prompts/08-integration-and-release-checklist.md` before demo day.

## Important workflow rules

- Antigravity owns the canonical schema, SQL migrations, backend domain rules and API contract.
- Claude implements Android against the approved API contract. Claude must not independently invent or modify the database schema.
- Both apps follow `design.md`, implemented using platform-specific components and centralized tokens.
- Keep all changes in version control. Review migrations and security rules before applying them to a shared or production Supabase project.
- Use only Supabase publishable/anon credentials in clients with RLS. Never expose service-role or secret keys in browser code or the APK.
- This kit is a starting specification. The coding agents must inspect existing repositories and current Supabase/Next.js SDK documentation before implementing.
