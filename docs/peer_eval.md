# Peer Evaluations

**Project:** Pair  -  Couples Friend-Matching App
**Team:** Heather Carminati & Edward Channeu

---

## Heather's Evaluation of Edward

**Overall Contribution Rating:** ⭐⭐⭐⭐⭐ (5/5)

**Technical Contributions:**
Edward owned the backend foundation this project relied on. He designed and implemented the Supabase schema migration and seed from scratch (#8), which gave us a solid data model that required zero structural changes throughout both sprints. His registration and login backend (#4)  -  including the Express auth middleware that verifies JWTs on every protected route  -  became the security backbone of the entire app. He also caught a route-guard vulnerability during E2E testing in Sprint 2 that I had missed, which was a direct contribution to the security acceptance criteria we had committed to.

**Testing Contributions:**
Edward led all E2E testing across both sprints (#6, #21). Writing Playwright tests against an async auth flow and a multi-step registration form is genuinely hard, and he handled the flaky-test debugging (timing issues on the interest chips component) without complaint and with a good technical solution.

**Collaboration and Communication:**
Edward communicated blockers clearly and early  -  for example, flagging the JWT extraction ambiguity before it became a blocker on the linking endpoint. He asked clarifying questions at the right time (e.g., confirming the `pairs.location` override behavior before building the couple profile preview) rather than making assumptions.

**Areas for Growth:**
Feature issue ownership was tilted toward me in Sprint 2. Edward has the skills to own more feature work alongside E2E responsibilities, and I'd like to see that balance in future sprints.

---

## Edward's Evaluation of Heather

**Overall Contribution Rating:** ⭐⭐⭐⭐⭐ (5/5)

**Technical Contributions:**
Heather set up the CI/CD pipeline on day one of Sprint 1 (#7), which immediately paid dividends  -  the lint and format failures that surfaced mid-sprint (#12) were caught in CI rather than production. She owned the invite token generation and partner-linking flow (#5) end-to-end, including the edge case guard preventing self-redemption (#15), which was a non-obvious security requirement that she identified and addressed proactively. In Sprint 2, she drove the profile and tag selection features (#17, #18) and enforced tag normalization at the service layer rather than just the UI  -  a deliberate architectural decision that prevented a class of duplicate-data bugs.

**Technical Leadership:**
Heather made the call to define shared TypeScript types in `/shared` before writing any new Sprint 2 endpoints  -  an action item from the Sprint 1 retro that she followed through on  -  and it measurably reduced integration friction between client and server.

**Collaboration and Communication:**
Heather surfaces design decisions clearly and involves me before making data-model calls that affect my work. When the `pairs.location` vs. `profiles.location` question came up, she paused and confirmed rather than guessing.

**Areas for Growth:**
Sometimes takes on too many feature issues in a single sprint. Distributing ownership more evenly would reduce risk if any one item runs long.
