---
name: add-feature-v1
description: Implement a new Pair app feature using TDD. Basic red-green-refactor flow without project-specific rule enforcement.
version: 1
---

Implement a new feature for the Pair app using test-driven development.

## Arguments

`$ARGUMENTS` — a user story ID from the PRD (e.g. `US-06`) or a short description of the feature.

## Step 1 — Extract requirements

Read `docs/pair-prd.md`. Find every functional requirement (FR-*) and user story (US-*) related to `$ARGUMENTS`. Note which layer owns each rule (backend vs. frontend vs. shared).

## Step 2 — Understand existing code

Read the relevant files before writing anything:
- `client/src/pages/` and `client/src/components/` for frontend context
- `server/src/routes/` and `server/src/services/` for backend context
- `shared/` for existing shared types

## Step 3 — Write failing tests (TDD red phase)

- Frontend: tests in `*.test.tsx` using Vitest + React Testing Library
- Backend: tests in `*.test.ts` using Vitest
- Run once to confirm they fail:
  ```bash
  npm run test
  ```

## Step 4 — Implement the feature (TDD green phase)

Write the minimum code to make the tests pass.

## Step 5 — Run all tests

```bash
npm run test
```

All tests must pass before finishing.

## Step 6 — Report

Output:
1. Which PRD requirements were addressed (FR-* / US-* IDs)
2. Files created or modified
3. Tests added
