# Antigravity Prompt — Phase 4: Admin Dashboard UI

Read `design.md` and the approved architecture/API docs first.

Build the responsive Next.js admin dashboard using React, TypeScript, Tailwind and the agreed accessible component system.

## Screens
- Login
- Overview
- Orders list, filters and order details
- Menu/product CRUD
- Categories
- Customers and order history
- Coupons
- Delivery settings
- Reports with date filters and CSV export
- Restaurant settings

## Requirements
- Implement reusable design tokens and components.
- Use actual Supabase-backed API data, not disconnected mock state, for integrated screens.
- Keep mock/demo fixtures clearly separated when needed.
- Protect admin routes and verify authorization on the server.
- Realtime order changes should update the order list where configured.
- Every visible action must work or be explicitly marked as unavailable in demo mode.
- Include loading, empty, error, success and confirmation states.
- Confirm destructive actions.
- Do not calculate authoritative revenue/totals from arbitrary client data.
- Support responsive desktop, tablet and mobile layouts.

## Quality gate
Run type checks, lint, tests and production build. Verify create/edit product, incoming order visibility, status transitions, role protection and CSV export. Report actual results and unresolved items.
