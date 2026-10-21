# Crust & Co. Pizza House — Shared Design System

Version: 1.0  
Platforms: Android customer app and Next.js admin dashboard

## 1. Brand and product principles

Crust & Co. is a modern, warm, approachable pizza brand. The customer experience should make discovering and ordering food delightful. The admin dashboard should help staff process orders quickly and accurately.

Principles:
- Food-first imagery.
- Clear pricing and order status.
- Consistent brand identity across platforms.
- Fast, low-friction customer checkout.
- Operational clarity for administrators.
- Accessible controls and honest demo states.

## 2. Color tokens

| Token | Hex | Use |
|---|---|---|
| brand-primary | `#D9362B` | Primary actions, active navigation |
| brand-primary-hover | `#B92B23` | Web hover/pressed state |
| brand-primary-soft | `#FCE8E5` | Selected chips and highlights |
| brand-secondary | `#F4B544` | Offer accents |
| canvas | `#FFF9F2` | Customer app background |
| surface | `#FFFFFF` | Cards, forms, dialogs |
| surface-subtle | `#F6F0E8` | Secondary areas |
| text-primary | `#27231F` | Main text |
| text-secondary | `#746D66` | Secondary text |
| border | `#E8DFD5` | Dividers and outlines |
| success | `#237A4B` | Delivered/success |
| success-soft | `#E4F4E9` | Success background |
| warning | `#9A6100` | Pending/warning |
| warning-soft | `#FFF1D3` | Warning background |
| error | `#B42318` | Errors/cancelled/failed |
| error-soft | `#FDE8E7` | Error background |
| information | `#245DA8` | Informational states |

Use color semantically. Status must also have text/icon; never communicate status by color alone. Keep contrast accessible.

## 3. Typography

Use Inter or an equivalent sans-serif, with platform-appropriate fallbacks.

| Style | Reference size | Weight | Use |
|---|---:|---|---|
| Display | 32 px | Bold | Customer hero |
| H1 | 28 px | Bold | Main page heading |
| H2 | 24 px | Semibold | Section heading |
| H3 | 20 px | Semibold | Card/detail heading |
| Body large | 16 px | Regular | Main content |
| Body | 14 px | Regular | Descriptions/tables |
| Label | 12 px | Medium | Metadata/chips |
| Button | 14–16 px | Semibold | Actions |

Android must support font scaling. Use tabular numerals for money and IDs where practical. Do not truncate essential totals or statuses.

### Token layers (dashboard implementation)

`backend/src/app/globals.css` organizes tokens in three layers:
1. **Primitive** (`--p-*`): raw hex and radius values. The only place hex appears.
2. **Semantic** (`--color-*`, `--radius-*`): names by purpose, aliasing primitives. Tailwind utilities such as `bg-brand` and `text-ink-2` read these.
3. **Component** (`--ticket-*`, `--focus-ring`): per-component decisions built from semantic tokens.

Components must never use raw hex. To change a brand value, edit the primitive; to re-theme, repoint the semantic layer.

## 4. Spacing

Use a 4 px base scale:
- 4, 8, 12, 16, 20, 24, 32, 40, 48 px.

Customer app:
- 16–20 px horizontal padding on standard phones.
- 12–16 px between related cards.
- 24–32 px between major sections.

Dashboard:
- Desktop sidebar around 240 px.
- 24 px page padding on desktop.
- 16–24 px between sections.
- Responsive navigation and tables at narrow widths.

## 5. Shapes and elevation

- Small controls: 8 px radius.
- Inputs/buttons: 10–12 px.
- Product cards: 16 px.
- Feature cards: 20 px.
- Dialogs/bottom sheets: 20–24 px.
- 1 px subtle borders.
- Restrained elevation; prefer spacing and surface contrast over heavy shadows.

## 6. Imagery and icons

Use realistic, high-quality food imagery with consistent crops. Product assets should be stable URLs or Supabase Storage URLs. Include loading placeholders and fallbacks. Do not stretch images or misrepresent products.

Use one consistent outline icon family. Avoid emoji as the primary icon system. Provide accessible labels for icon-only controls.

## 7. Android customer app patterns

Primary navigation:
- Home
- Menu
- Orders
- Profile

Keep cart accessible from home, menu and product screens.

Home order:
1. Brand header and delivery location.
2. Search/menu discovery.
3. Promotional banner.
4. Categories.
5. Bestsellers.
6. Recommendations.
7. Offers/combos.

Product cards include image, name, description where useful, price, dietary indicator, bestseller label where applicable, and add/customize action.

Product detail includes image, name, description, size, crust, toppings, quantity, live indicative price and prominent add-to-cart action. Clearly distinguish required selections and optional charges.

Cart must show item customizations and a transparent breakdown: subtotal, discount, tax, delivery fee, total.

Checkout includes address, instructions, payment method and full price summary. Simulated online payment must be labelled as demo functionality. Prevent duplicate submissions.

Order tracking uses the canonical backend status and timestamps. Never fake progress or claim GPS tracking without an actual implementation.

## 8. Admin dashboard patterns

Primary navigation:
- Overview
- Orders
- Menu
- Categories
- Customers
- Offers & Coupons
- Delivery
- Reports
- Settings

Use a desktop sidebar, clear page titles, contextual actions, readable tables, search/filter/pagination where needed, and order details in a drawer or page.

Dashboard overview shows:
- Today's orders
- Today's revenue
- Pending orders
- Completed orders
- Recent orders
- Sales trend where data supports it

Do not display invented metrics as real. Label seeded demo data.

Order detail includes customer, address, line items/customizations, price breakdown, payment status, status history and valid next actions. Confirm destructive actions.

## 9. Shared components

Buttons:
- Primary: brand red with white text.
- Secondary: neutral surface and optional subtle border.
- Destructive: reserved for cancellation/rejection.
- Provide loading, disabled, pressed and focus states.

Inputs:
- Visible labels, consistent padding, validation, accessible errors.
- Never rely only on placeholder text.

Statuses:
- Pending: amber.
- Accepted: blue.
- Preparing: amber.
- Ready for dispatch: blue.
- Out for delivery: blue.
- Delivered: green.
- Rejected/cancelled/payment failed: red.

Every major list has an empty state. Errors must be actionable. Loading and error states must not resemble success.

## 10. Accessibility and responsive design

- Readable contrast.
- Keyboard navigation and visible focus on web.
- Android font scaling.
- Icon labels where needed.
- Android touch targets aim for at least 48 dp.
- Status never conveyed only by color.
- No horizontal overflow at supported widths.
- Avoid fixed heights for text-heavy content.

## 11. Architecture and design governance

This file is the source of truth for visual tokens and interaction conventions.

Other authoritative documents:
- `docs/architecture.md`: module boundaries and dependencies.
- `docs/database-schema.md`: canonical data model.
- `docs/api-contract.md`: HTTP contracts.
- `docs/order-lifecycle.md`: state transitions.
- `docs/security-and-rls.md`: authorization and RLS.
- SQL migrations: executable database schema history.

Android implements tokens using Compose theme, typography, shapes and reusable composables. Next.js implements them using CSS variables, Tailwind configuration and reusable React components. Do not attempt to share React components with Android.

When a token changes, update this document and both platform implementations.

## 12. New-feature change process

Before cross-cutting changes, assess:
1. User need and scope.
2. Affected modules.
3. Database migration.
4. API contract changes and compatibility.
5. Authorization/security.
6. Android and dashboard changes.
7. Design-system impact.
8. Tests, observability and rollback.

Prefer additive migrations and backward-compatible contracts. Do not create speculative modules/tables for unapproved features.

## 13. Quality gate

A feature is complete only when its visual states, API contract, migration (if any), authorization, tests and documentation are updated. Both frontends must remain visually consistent and existing features must continue to work.
