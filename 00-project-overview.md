# Project Overview

## Product
**Crust & Co. Pizza House** — a demo online ordering and delivery system.

## Applications
1. **Android customer app** — Claude, Kotlin, Jetpack Compose, MVVM.
2. **Admin dashboard and backend** — Google Antigravity, Next.js App Router, TypeScript.
3. **Shared backend services** — Supabase PostgreSQL, Auth, Storage, Realtime.

## Core demo journey
1. Customer browses categories and products.
2. Customer chooses size, crust, and toppings.
3. Customer adds items to cart and submits checkout.
4. Next.js backend validates current prices, availability, delivery rules, and coupon.
5. The backend creates a persistent order and order-item snapshots.
6. Admin sees the order in the dashboard.
7. Admin updates order status.
8. Android app displays the persisted status, using authorized Realtime updates where configured.

## Architectural principles
- Modular monolith, not microservices.
- Contract-first API development.
- Database-first migrations and explicit RLS.
- Loose coupling between UI, domain rules, API handlers, data access and external providers.
- No duplicated authoritative checkout logic in clients.
- Future extension points without speculative implementation.
- Tests and docs evolve with schema/API changes.

## Initial scope
- Product catalog, categories, variants, customization options.
- Customer profile and addresses.
- Orders, order items, status history.
- Coupons and coupon redemption.
- Payments as demo records only.
- Delivery zones and settings.
- Admin roles and branch scope prepared for future growth.

## Not in initial scope
Do not implement loyalty programs, subscriptions, delivery partner apps, real payment gateway processing, GPS delivery tracking, microservices, Kafka or Kubernetes unless separately approved.
