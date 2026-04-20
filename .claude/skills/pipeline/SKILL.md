---
name: pipeline
description: Run all CI checks locally to verify a PR will pass before pushing.
---

Run every check that CI runs, in the same order, and report results.

## Step 1 — Confirm clean working state

```bash
git status
```

Warn if there are uncommitted changes — they won't be in the PR diff.

## Step 2 — Install dependencies

```bash
npm ci
```

Fail fast if this fails — all subsequent steps depend on it.

## Step 3 — Lint

```bash
npm run lint
```

Mirrors CI step: `Lint`. Fix any errors before continuing.

## Step 4 — Format check

```bash
npm run format:check
```

Not in CI but a common source of review friction. Report any unformatted files.

## Step 5 — Test client

```bash
npm run test:client
```

Mirrors CI step: `Test client`.

## Step 6 — Test server

```bash
npm run test:server
```

Mirrors CI step: `Test server`.

## Step 7 — Build client

```bash
npm run build --workspace=client
```

Mirrors CI step: `Build client`. Catches TypeScript errors and bundle failures that tests won't catch.

## Step 8 — Report

Output a table with one row per step:

| Step | Status | Notes |
|------|--------|-------|
| Dependencies | ✅ / ❌ | |
| Lint | ✅ / ❌ | list any errors |
| Format | ✅ / ⚠️ | list unformatted files |
| Test client | ✅ / ❌ | failing test names |
| Test server | ✅ / ❌ | failing test names |
| Build | ✅ / ❌ | TypeScript or bundle errors |

Then give a single verdict:

**✅ PR is ready to push** — all CI checks will pass.

or

**❌ PR will fail CI** — fix the issues listed above first.
