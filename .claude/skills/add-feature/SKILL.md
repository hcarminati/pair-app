---
name: add-feature
description: Implement a new Pair app feature using TDD, enforcing dual-consent, tag normalization, connection state machine, and all project business rules.
---

Implement a new feature for the Pair app. Follows TDD and enforces all Pair-specific business rules before finishing.

## Arguments

`$ARGUMENTS` — a user story ID from the PRD (e.g. `US-06`) or a short description of the feature.

## Step 1 — Extract requirements

Read `docs/pair-prd.md`. Find every functional requirement (FR-*) and user story (US-*) related to `$ARGUMENTS`. Note:
- Which layer owns each rule (backend only vs. frontend only vs. shared)
- Any state transitions involved (`INTEREST_PENDING → INTEREST_ALIGNED → REQUEST_PENDING → CONNECTED → DECLINED`)
- Whether dual-consent is in scope

## Step 2 — Understand existing code

Read the relevant files before writing anything:
- `client/src/pages/` and `client/src/components/` for frontend context
- `server/src/routes/` and `server/src/services/` for backend context
- `shared/` for existing shared types

Check if a similar pattern already exists — prefer extending it over creating a new abstraction.

## Step 3 — Write failing tests (TDD red phase)

- Frontend: tests in `*.test.tsx` using Vitest + React Testing Library
- Backend: tests in `*.test.ts` using Vitest; hit real Supabase test instance (no mocks on DB)
- E2E critical path: add a Playwright test in `e2e/` if this touches onboarding, partner linking, discovery, connection request, or chat
- Run once to confirm tests fail:
  ```bash
  npm run test
  ```

## Step 4 — Implement the feature (TDD green phase)

Write the minimum code to make tests pass. Apply these Pair-specific rules as you implement:

### Dual-consent (FR-CONN-03)
Connection state transitions MUST live in `server/src/services/`, not in route handlers or client code.

### Duplicate-request guard (FR-CONN-09)
Before inserting a `connection_requests` row, query for an existing request between the two couples in **any direction** and **any status**. If one exists, surface it instead of inserting.

### Tag normalization (FR-TAG-03)
All tags must be `.toLowerCase().trim()` before insert. Use the shared `normalizeTag` util in `shared/`. Do not re-implement inline.

### Partner privacy (FR-CONN-08)
If surfacing a DECLINED status to couple 1, never expose which partner of couple 2 declined. Return only the status.

### Service role key
The Supabase service role key MUST only appear in `server/` environment variables. Never import it in `client/`.

### TypeScript
- Strict mode — no `any`
- Shared types (couple, connection_request, tag) belong in `shared/`
- Named exports for components/utils; default exports for page components only

## Step 5 — Run all tests

```bash
npm run test
```

All tests must pass. Fix any failures before proceeding.

## Step 6 — Self-check against business rules

Before reporting done, verify each item:

- [ ] Connection state transitions are only in `server/src/services/`
- [ ] No direct Supabase state mutations in client code (all go through Express API)
- [ ] Duplicate-request check present before any `connection_requests` insert
- [ ] Tags normalized (lowercase + trim) at service layer
- [ ] Incomplete couples (one partner unregistered) excluded from discovery feed results
- [ ] Partner privacy preserved — declining partner identity not exposed
- [ ] Supabase service role key not referenced in `client/`
- [ ] No `any` types introduced
- [ ] Shared types added to `shared/` if new types were needed

## Step 7 — Report

Output:
1. Which PRD requirements were addressed (FR-* / US-* IDs)
2. Files created or modified
3. Tests added
4. Any business rule checks that required a code change
