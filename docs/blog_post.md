# Beyond Autocomplete: How Claude Code Changed the Way We Build Software

*By [Your Name], built with [partner name] as part of CS7180*

---

Building Pair, a couples-only friend-matching web app. This isn't a post about AI replacing developers. It's about what changes when you give AI a real role in your workflow rather than treating it as a smarter autocomplete. Claude Code let us do that by giving it memory, constraints, and specialized jobs. The result changed how we think about software development in ways that will outlast this project.

---

## What We Built

Pair is a web app where couples (two linked user accounts) can discover and connect with other couples. The unit of identity is the couple, not the individual, which makes the authorization logic genuinely interesting: every connection goes through a four-person dual-consent state machine, where a request isn't sent to another couple until both partners of the requesting couple have independently said yes. A single veto anywhere in the chain declines the request.

The stack is React + TypeScript on the frontend (deployed to Netlify), Express on the backend (deployed to Render), and Supabase for the database and real-time chat. The codebase is a monorepo with a shared `/shared` directory for types used by both client and server.

---

## The First Thing That Actually Changed: CLAUDE.md

The most valuable thing we built in the first week wasn't a feature. It was `CLAUDE.md`.

CLAUDE.md is the context file that Claude Code reads at the start of every session. Ours started as a quick summary of the tech stack and grew, over two sprints, into a full specification of the project's architecture, data model, connection state machine, coding conventions, security requirements, and business rules. It uses `@import` to pull in our PRD as a separate file, keeping the two concerns organized.

What we didn't expect was what writing it would do for us, independent of Claude. The act of writing down "the connection state machine transitions are enforced only in the Express service layer, never in client code" forced us to commit to that architectural decision explicitly. Before CLAUDE.md, it was a loose intention. After, it was a rule we'd written down and would have to consciously violate. That's a different thing.

The git history on CLAUDE.md tells the story of the project's decisions. You can see where we added the note about `pairs.location` overriding `profiles.location` after a mid-sprint clarification. You can see the security table get filled in as we added routes. If you want to understand why the codebase looks the way it does, read the CLAUDE.md commits.

---

## Custom Skills: Encoding What "Done" Means

We wrote two custom skills for the project: `add-feature` and `pipeline`.

The `add-feature` skill is the one we're most proud of. It's a seven-step workflow that starts by reading the PRD, checks for existing patterns before creating new abstractions, writes failing tests first, implements the minimum code to make them pass, and then runs a self-check against a list of Pair-specific business rules before reporting done. That checklist includes things like:

- Are connection state transitions only in `server/src/services/`?
- Is the duplicate-request check present before any `connection_requests` insert?
- Are tags normalized (lowercase + trim) at the service layer?
- Is the Supabase service role key absent from any file under `client/`?

Writing this skill was the moment we realized that the real value of a custom skill isn't speed; it's making implicit knowledge explicit. Every item on that checklist was a rule we had been holding loosely and occasionally forgetting to apply. The skill made it impossible to forget, because Claude wouldn't report done until each box was checked.

The `pipeline` skill is simpler: it runs every CI check locally in the same order CI runs them and reports a table of results. The last line is either "✅ PR is ready to push" or "❌ PR will fail CI. Fix the issues listed above first." We ran it before every push. Zero CI surprises.

---

## Hooks: Quality Enforcement That Doesn't Rely on Memory

We have three hooks configured in `.claude/settings.json`.

The **PostToolUse hook** runs Prettier on every file after Claude writes or edits it. Formatting is never a decision anymore; it's just done. We haven't had a formatting comment in a code review since we set it up.

The **PreToolUse hook** on `git push` runs lint and format check before the push goes through. It's caught issues that would have failed CI before they ever left the machine.

The **Stop hook** is the most impactful one. It blocks Claude from ending a session if unit tests are failing. That sounds minor until you're deep in a feature, context-switching between tasks, and you would have just closed the session without running the test suite. The Stop hook has caught failures introduced a few commits back; finding them in-session is dramatically cheaper than finding them in CI or in review.

The pattern here is: hooks enforce constraints that don't depend on anyone remembering to apply them. The cognitive load of switching contexts mid-sprint is real, and every hook is one fewer thing to hold in working memory.

---

## The Security Reviewer Agent

Before merging any PR that touched auth, routes, or database logic, we ran the `security-reviewer` agent.

The agent is configured with the OWASP Top 10, a set of Pair-specific rules (service role key never in client code, connection state transitions only in the service layer, no raw error objects returned to the client), and a specific output format: findings organized by severity with the OWASP category, file, line number, and a recommended fix for each one.

The most useful thing it caught was an Express route that was returning a full error object on a 500, including the stack trace. It wasn't a catastrophic vulnerability, but it was exactly the kind of thing that's invisible in code review because it doesn't affect functionality. The agent found it on the second PR that touched that route.

Running a dedicated security pass isn't new. What's new is that it's the default, not a special effort. When security review is something you have to schedule and remember to do, it happens inconsistently. When it's a configured agent you invoke before merging, it happens every time.

---

## TDD With an AI Partner Is Different Than TDD Alone

We committed to a strict TDD workflow: failing tests committed before implementation, visible in the git history. We had both done TDD before. Doing it with Claude Code as the implementer changed the dynamic in an interesting way.

When you write the tests and Claude writes the implementation, the red phase becomes a specification process. You have to be precise enough about the expected behavior that the tests actually capture it; because if the tests are vague, Claude will write code that passes vague tests, and that's not the same as code that does what you want.

The invite token tests are a good example. We wrote a test that verified a user couldn't redeem their own invite token. That test forced us to think about how the backend would know who "owns" the token, which meant thinking through what the token record stores and what the auth context provides at redemption time. Writing the test before the implementation made the design question unavoidable.

The git history shows this pattern throughout: commits with failing tests and no implementation, followed by the implementation commit, followed occasionally by a refactor commit. That rhythm is visible and it's honest. It also proves the process rather than just asserting it.

---

## The Figma MCP Server: Design to Code Without the Handoff Tax

Partway through the project we connected the Figma MCP server to Claude Code. This let Claude read our Figma designs directly, pulling component structure, layout, and design tokens from a file URL without us describing what we wanted or pasting screenshots into the chat.

The practical impact showed up most during UI implementation. Instead of the usual handoff process, we'd share a Figma node link and ask Claude to implement it. Claude would read the design context, identify which existing components in the codebase matched the intent, and generate code that used them. It wasn't pixel-perfect on the first pass every time, but it was close enough that iteration was fast. The gap between "this is what we designed" and "this is what got built" narrowed considerably.

The more interesting effect was on consistency. When Claude is reading the same design source directly each time, it doesn't drift the way manual implementation does. Spacing, color usage, and component choices stayed coherent across features because they all traced back to the same file.

If we were starting this project over, we'd set up the Figma MCP integration on day one.

---

## What We'd Tell Someone Starting a Similar Project

**Write CLAUDE.md before you write code.** Not because Claude needs it; because you need to have the conversation with yourself about what the architectural rules actually are. The document is a forcing function for decisions you'd otherwise defer.

**Use the hooks system for quality enforcement, not reminders.** A hook that blocks bad behavior is worth ten reminders to check something. The Stop hook on failing tests is the most valuable line of configuration in our project.

**Write custom skills for workflows you'll repeat.** The first draft of `add-feature` was rough. We iterated it after the first sprint when we noticed Claude was skipping a critical business rule check. The second version has it explicitly in the self-verification step. Skills get better when you use them; treat them like code.

**Start E2E tests early.** Our most useful bugs were found by Playwright, not by unit tests or code review. E2E tests find the gaps between components: the places where your mental model of how the pieces fit together is wrong. Those are the bugs that matter.

Pair is live at [pair-app.netlify.app](https://pair-app.netlify.app). The full source, including all `.claude/` configuration, is on [GitHub](https://github.com/hcarminati/pair-app).

---

*Built with React, Express, Supabase, and Claude Code. 100% of features written test-first.*
