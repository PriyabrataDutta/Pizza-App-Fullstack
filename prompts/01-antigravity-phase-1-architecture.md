# Antigravity Prompt — Phase 1: Architecture and Contracts

You are the architecture owner for Crust & Co. Pizza House. Inspect the existing repository first. Do not begin building the full dashboard yet.

Read:
- `00-project-overview.md`
- `design.md`
- `docs/database-schema.md`
- `docs/architecture.md`
- `docs/api-contract.md`
- `docs/order-lifecycle.md`
- `docs/security-and-rls.md`

## Tasks
1. Report current repository stack, structure, dependencies and existing work.
2. Identify conflicts between repository state and the project specification.
3. Refine the modular-monolith architecture for Next.js + Supabase.
4. Resolve schema ambiguities, especially guest checkout, role/branch scope, coupon usage, payment states and address snapshots.
5. Produce/update architecture, schema, API, order lifecycle and security docs.
6. Create an ER diagram using Mermaid in `docs/database-schema.md` or a separate `docs/erd.md`.
7. Define API request/response schemas and stable error codes.
8. Define module boundaries and dependency direction.
9. Define an architecture decision record for meaningful decisions.
10. Propose implementation phases and test strategy.

## Constraints
- Do not independently alter the approved business scope.
- Do not add speculative future tables.
- Do not use microservices.
- Do not start feature UI implementation before architecture review.
- Do not claim RLS or APIs are implemented until tested.
- Read current official documentation for library/API details when necessary.

## Deliverables
Return:
- Repository assessment.
- Proposed directory tree.
- Architecture documents changed.
- Final schema decisions requiring approval.
- Final API contract proposal.
- Security/RLS plan.
- Phase-by-phase plan.
- Open questions and risks.

Stop after presenting the architecture for review.
