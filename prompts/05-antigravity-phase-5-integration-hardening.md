# Antigravity Prompt — Phase 5: Integration and Hardening

Review the integrated Android and dashboard flow against all docs.

## Checklist
- Validate all API request/response contracts.
- Verify checkout pricing and option compatibility server-side.
- Verify idempotency under retries.
- Verify coupon limit enforcement and race conditions.
- Verify all allowed and disallowed order status transitions.
- Verify customer ownership and admin branch scope.
- Verify RLS and Realtime authorization.
- Verify errors are stable and do not leak secrets.
- Verify migrations apply from a clean database.
- Verify seed data and demo reset instructions.
- Verify environment configuration for local/demo deployment.
- Add rate limiting where appropriate to sensitive endpoints.
- Add structured logs without sensitive personal/payment data.
- Document backups, migration order and rollback limitations.
- Update architecture and API docs for all deviations.

Do not claim production readiness merely because the demo works. List remaining risks and required steps for real payments, privacy compliance and production deployment.
