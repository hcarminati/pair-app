# Sprint 1 Retrospective

**Date:** April 7, 2026

## What went well?
- CI/CD pipeline was set up on day one of the sprint, so lint and test failures were caught immediately on every push.
- Supabase schema design (single-use tokens, `pairs` table created on linking) held up without changes through the full sprint.
- The `invite_tokens` service layer correctly handled expiry and self-redemption edge cases before either was caught in QA.
- Playwright E2E tests were green for the full auth and partner-linking flow by end of sprint.

## What could be improved?
- Linting was not enforced locally at the start of the sprint, leading to a mid-sprint cleanup issue (#12) that could have been avoided.
- The boundary between service-layer authorization and route-handler logic was unclear early on, causing one rework cycle on the linking endpoint.

## Action Items for Next Sprint
1. Add shared TypeScript types in `/shared` before writing any new endpoints, so client and server stay in sync from the start.
2. Configure ESLint and Prettier with a pre-commit hook so linting issues never reach CI.
3. Define a route-guard checklist item in the Definition of Done for any sprint introducing new pages or endpoints.
