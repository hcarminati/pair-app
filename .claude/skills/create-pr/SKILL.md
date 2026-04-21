---
name: create-pr
description: Run quality checks then open a GitHub PR for the current branch with a structured summary, test results, and security confirmation.
version: 1
---

Create a pull request for the current branch against `develop`. Runs lint, format check, type-check, tests, and security scan first — only opens the PR if all pass.

## Arguments

`$ARGUMENTS` — optional issue number to close (e.g. `42`). If provided, the PR body will include `Closes #$ARGUMENTS`.

## Step 1 — Confirm branch state

```bash
git status
git log develop..HEAD --oneline
```

Abort and tell the user if there are uncommitted changes or if the branch has no commits ahead of `develop`.

## Step 2 — Parse branch name

Get the current branch:
```bash
git branch --show-current
```

Branch format: `type/number-short-description` (e.g. `feature/28-discovery-feed-tag-filtering`)

Parse out:
- **type** — the part before `/` (e.g. `feature`, `fix`, `chore`)
- **issue number** — the digits immediately after `/` up to the first `-` (e.g. `28`)
- **description** — everything after `number-`, with `-` replaced by spaces, title-cased (e.g. `Discovery Feed Tag Filtering`)

Compose the PR title as: `type: description` (e.g. `feat: Discovery Feed Tag Filtering`)

If `$ARGUMENTS` is provided and differs from the parsed issue number, prefer `$ARGUMENTS` for the closes line.

## Step 3 — Run quality gates

Run each check and capture any failures. Do NOT skip a check even if a prior one fails — collect all issues first.

```bash
# Lint
npm run lint

# Format check
npm run format:check

# Type check
npx tsc --noEmit -p client/tsconfig.app.json && npx tsc --noEmit -p server/tsconfig.json

# Tests
npm run test

# Security audit
npm audit --audit-level=high
```

If any check fails, report every failure clearly and stop. Do not open the PR until all gates pass.

## Step 4 — Gather PR metadata

Collect:
- Commits since develop: `git log develop..HEAD --oneline`
- Changed files: `git diff --name-only develop...HEAD`

From the changed files and commits, identify:
- **Layers touched**: client / server / shared / e2e / CI
- **Security-sensitive paths**: any file under `server/src/middleware/`, `server/src/routes/`, or files touching auth, tokens, or Supabase keys

If security-sensitive paths changed, note that the security workflow will run automatically in CI.

## Step 5 — Security acceptance checklist

Answer each item based on the changed files:

- [ ] No secrets or API keys committed (`git diff develop...HEAD` grep for `SUPABASE_SERVICE_ROLE_KEY`, `secret`, `password` in non-env files)
- [ ] Supabase service role key not referenced in `client/`
- [ ] All new Express routes protected by auth middleware (unless explicitly public)
- [ ] `npm audit --audit-level=high` passed (Step 3)
- [ ] No raw error details returned to the client

## Step 6 — Open the PR

Push the branch if not yet on remote:
```bash
git push -u origin HEAD
```

Then create the PR:

```bash
gh pr create --base develop --title "<title>" --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>
- <bullet 3>

## Changes
| Layer | Files |
|-------|-------|
| client | ... |
| server | ... |

## Test plan
- [ ] All unit + integration tests pass (`npm run test`)
- [ ] Lint and format check pass
- [ ] Type-check passes
- [ ] `npm audit --audit-level=high` passes
- [ ] <feature-specific manual check>

## Security checklist
- [x] No secrets committed
- [x] Service role key not in client
- [x] New routes protected by auth middleware
- [x] `npm audit --audit-level=high` passes
- [x] No raw errors returned to client

Closes #<issue-number>

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

Use the issue number parsed from the branch name (or `$ARGUMENTS` if provided).

## Step 7 — Report

Output:
1. PR URL
2. Which quality gates passed
3. Any security-sensitive paths changed and whether the security workflow will trigger
