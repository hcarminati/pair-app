# HW5 Retrospective: Custom Skill + MCP Integration

**Project:** Pair — couples-only friend-matching web app
**Date:** March 30, 2026

---

## Part 1: How the Custom Skill Changed My Workflow

### The skill: `/add-feature`

Before the skill existed, implementing a feature for Pair required keeping a long mental checklist active throughout development: remember to write tests first, remember to normalize tags at the service layer not the UI, remember to check for duplicate connection requests before inserting, remember that state transitions belong in `server/src/services/` and nowhere else. These rules are specific to this project and easy to omit under time pressure. On two occasions during earlier development, code review caught a state transition written directly in a route handler and tag normalization happening in a React component — both correct in behavior but wrong in layer.

The `/add-feature` skill encodes that checklist as a machine-readable prompt. The key differences in practice:

**What became easier:**
- Starting a new feature no longer requires re-reading CLAUDE.md for the business rules. The skill is the checklist.
- The TDD structure is enforced by the skill itself — it won't proceed to implementation without first running failing tests, which eliminated the temptation to write the implementation first and retrofit tests.
- The self-check block in Step 6 (v2) acts as a pre-PR gate. I can run `/add-feature` and trust that if it completes without complaint, the obvious architectural violations have been caught.

**What the v1 → v2 iteration revealed:**

v1 was a generic TDD scaffold. It worked, but when applied to implementing the connection request flow it produced code that:
1. Put the duplicate-request check in the route handler (FR-CONN-09) instead of the service layer
2. Normalized tags in the React form's `onChange` handler instead of `server/src/services/tags.ts`
3. Transitioned connection state inside `POST /connections` route handler directly

None of these were bugs — the behavior was correct — but all three violated the project's layering rules, which matter for long-term maintainability and testability. v2 added an explicit, enumerated self-check list (Step 6) and inline annotations for each Pair-specific rule (dual-consent, FR-CONN-09, tag normalization, partner privacy) so they are applied during implementation rather than discovered in review.

The concrete improvement: running `/add-feature US-09` with v2 produced a service-layer implementation that passed the self-check checklist without any manual correction. v1 required two iterations.

**Before/after example:**

Without the skill, implementing the discovery feed (US-06) meant typing something like:
> "Read the PRD, find the requirements for the discovery feed, write failing tests first covering shared tag ranking, own couple exclusion, incomplete couple exclusion, and already-connected exclusion, then implement it, run the tests, and make sure state transitions are only in the service layer, tags are normalized at the service layer, and the duplicate request check is present..."

With the skill:
```
/add-feature US-06
```

That single command expands into the full 7-step workflow — PRD lookup, failing tests, implementation, test run, and the Step 6 self-check — with all the project's architectural rules already baked in. Anyone on the team can run it and get the same disciplined, rule-compliant output without needing to know every constraint by heart.

---

## Part 2: What MCP Integration Enabled

### GitHub MCP

Before MCP, working with GitHub issues meant: open browser → find issue → read it → copy relevant text → switch back to Claude Code → paste. Small friction individually, but it interrupts flow and introduces copy-paste errors in requirements.

The GitHub MCP eliminated context switching for requirement lookup. In a single Claude Code session, I could ask it to list open issues, read a specific issue's acceptance criteria, then pass those criteria directly into `/add-feature` — no browser, no copy-paste.

**What it enabled that wasn't possible before:**

1. **Traceability in both directions.** After implementing a feature, the MCP could comment on the originating GitHub issue with a link to the commit and a summary of which FR-* requirements were addressed. This creates a permanent record connecting implementation to requirement — previously this was done manually and inconsistently.

2. **Issue-driven feature invocation.** Instead of `/add-feature US-06`, I could say *"implement the highest-priority open issue"* and Claude Code would query GitHub, rank by label, and invoke the skill with the full issue context. This makes the backlog itself the source of truth for what to build next.

3. **CI awareness.** Checking whether a PR's tests were passing required opening GitHub Actions in the browser. With the MCP, Claude Code could call `github_list_workflow_runs` inline during a session and flag a failing run before suggesting to merge.

---

## Part 3: What I Would Build Next

### Hooks

The existing Prettier hook (PostToolUse on Write/Edit) is the right pattern. I would add:

- **A PostToolUse hook on Bash** that runs `npm run lint` whenever a `.ts` or `.tsx` file is modified. Currently linting only happens at commit time; surfacing it immediately would shorten the feedback loop.
- **A PreToolUse hook** that blocks any `Edit` to `server/src/` that adds an `import` referencing the Supabase anon key variable name — a lightweight guardrail against the service-role-key-on-client rule.

### Sub-agents

The current `/add-feature` skill is linear. For larger features spanning multiple routes and pages, a sub-agent architecture would help:
- A **test-writer sub-agent** that focuses only on writing the failing tests given a spec
- An **implementation sub-agent** that receives the failing tests as input and writes the minimum code to pass them
- A **business-rule reviewer sub-agent** that runs the Step 6 checklist independently of the implementation agent

This mirrors a human pair-programming model and would catch more violations than a single-agent linear flow.

### More skills

- **`/review`** — Reads the diff of a branch against `develop`, checks it against Pair's business rules and CLAUDE.md conventions, and outputs a structured review. This is the complement to `/add-feature`: the skill for the PR review step.
- **`/db-migrate`** — Scaffolds a Supabase migration file from a description, validates that it doesn't expose RLS bypass vectors, and generates the corresponding TypeScript type updates in `shared/`.

---

## Summary

The custom skill and MCP integration together shifted the workflow from *Claude Code as a fast text editor* to *Claude Code as a project-aware development assistant*. The skill enforces project-specific constraints automatically; the MCP closes the loop between the repository's issue tracker and the implementation. The clearest evidence of value: two architectural violations caught by the v2 self-check that v1 missed, and zero context-switches to a browser for the full feature implementation session.
