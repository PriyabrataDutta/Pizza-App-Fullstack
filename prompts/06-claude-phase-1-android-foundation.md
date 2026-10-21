# Claude Prompt — Android Phase 1: Foundation and Design System

You own the native Android customer app. You do not own the canonical database schema or Next.js API contract.

## Mandatory documents
Read `design.md`, `docs/architecture.md`, `docs/database-schema.md`, `docs/api-contract.md`, `docs/order-lifecycle.md`, and `docs/security-and-rls.md`. If these are not available in your repository, request them rather than inventing the schema.

## Technology
Kotlin, Jetpack Compose, Material 3, MVVM, Coroutines/StateFlow, Navigation Compose, Retrofit/OkHttp, Kotlin Serialization, Coil, and Hilt if justified.

## Tasks
1. Inspect existing project and Gradle setup.
2. Propose feature-based architecture and dependency direction.
3. Implement centralized Compose theme tokens from `design.md`.
4. Set up navigation, error/loading state patterns and API client.
5. Define typed DTOs from the approved API contract.
6. Define domain models and DTO mappers.
7. Add mock repositories only behind the same repository interfaces used by real implementations.
8. Configure API base URL without embedding secrets.
9. Add tests for mapping, network errors and state handling.

## Boundaries
- UI must not call Supabase tables directly for operations owned by Next.js APIs.
- Do not invent endpoint paths or payload fields.
- Never embed service-role/secret credentials.
- Keep domain models independent of Compose and Retrofit DTOs.
- Do not implement authoritative checkout pricing on device.

Stop after the foundation is built and report build/test results.
