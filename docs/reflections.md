# Individual Reflections

**Project:** Pair  -  Couples Friend-Matching App

---

## Heather Carminati

Building Pair was the first time I used AI assistance not just as a code generator but as an active participant in a software development workflow  -  and the difference in how I think about that tool has been the most meaningful outcome of this project.

Early on, I treated Claude Code the way I had used autocomplete: prompt it, accept or reject, move on. The first time I saw a real shift was when I set up the `add-feature` skill. Writing a skill forces you to articulate your own conventions explicitly  -  what does "done" mean for a feature in this codebase? What checks need to pass? What tests need to exist first? I found myself writing things down that I had previously held loosely in my head, and the act of codifying them made me a more consistent developer, independent of whether Claude followed them.

The TDD workflow was the other inflection point. I had written tests before, but always after the fact. On this project, the constraint was that failing tests had to be committed before implementation  -  and that constraint changed how I designed features. When I was building the invite token flow, I wrote the test for the self-redemption guard before I had any implementation, and the act of writing that test forced me to think through the edge case more carefully than I would have otherwise. The red-green-refactor loop isn't just a process ritual; it's a thinking tool.

What surprised me about Claude Code specifically was the hooks system. The Stop hook that blocks session exit if tests are failing has saved me from committing broken code more than once  -  not because I'm careless, but because the cognitive load of switching contexts mid-sprint is real, and having an automated check that doesn't rely on my remembering to run tests is genuinely valuable. The PostToolUse Prettier hook is smaller but similarly impactful: formatting is no longer a decision I make, so I never have a formatting debate with myself or with a collaborator.

The hardest part of this project was the connection state machine. The logic  -  dual consent across four participants, with a state that can be vetoed at any stage by anyone  -  is inherently complex, and keeping that logic in the Express service layer rather than leaking it into route handlers or the frontend required discipline every time I touched a related endpoint. What helped was having the state machine documented in CLAUDE.md from the beginning. When I came back to connection-related code after working on something else, the documentation let me re-enter the context quickly.

If I were starting over, I would invest earlier in the MCP server integration. Having GitHub Issues, PR comments, and branch management available inside the Claude Code session reduced context-switching significantly once it was set up, but I set it up later than I should have. That tooling changes what questions you can ask and answer without leaving your editor.

---

## Edward Channeu

This project changed my relationship with testing. I came in thinking of E2E tests as a chore  -  something you write at the end to prove the thing works before you submit it. I leave thinking of them as the most valuable feedback mechanism I have access to during development.

The clearest example was in Sprint 2. I was writing Playwright tests for the couple profile route, and the tests kept failing because an unauthenticated user could reach the page. That wasn't a test problem  -  it was a real bug, a missing route guard. The tests didn't just verify the feature; they found a security gap that design review and code review had both missed. That reframing  -  tests as a continuous audit of assumptions, not a final checkbox  -  is something I'll carry into every project going forward.

Working with Claude Code reshaped how I think about code ownership. When I'm the one writing every line, I have full context on every decision. When AI is involved in some of the writing, the code is still mine to own and defend  -  but the process of reviewing AI-generated code taught me to read more carefully and question more deliberately. I found myself asking "why is this structured this way?" more often than I would have with my own code, which I tend to rationalize rather than question.

The security-reviewer agent was particularly instructive. Running a dedicated security pass on a PR before merging isn't something I had done systematically before, but having it configured as part of the workflow made it feel like a normal part of development rather than an extra step. It flagged a case where an error response was returning more information than it should  -  a minor leak, but exactly the kind of thing that's easy to miss in review because it's not a functional bug.

The schema design work in Sprint 1 was where I felt most confident. Designing the `invite_tokens`, `profiles`, and `pairs` tables required thinking through the full lifecycle of the data  -  how tokens expire, how linking creates a new record, what happens on delink  -  before writing a line of application code. That upfront modeling paid off across the whole project: we never had to do a schema migration mid-sprint, which kept the development velocity higher than I expected.

The area I want to improve is feature ownership. I owned the backend schema and E2E tests across both sprints, which gave me depth in those areas but limited my exposure to the frontend and the service layer. Going forward I want to work across the full stack in every sprint, even if it means owning smaller pieces, because the handoff friction between front and back is where the most interesting bugs live.

The most useful thing I built in this project might be the documentation. Writing the schema decisions down in CLAUDE.md, articulating the state machine, defining what a "complete couple" means  -  that work made the codebase legible to my partner and to my future self in a way that comments inside files never quite achieve.
