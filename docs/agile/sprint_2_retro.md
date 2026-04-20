# Sprint 2 Retrospective

**Date:** April 19, 2026

## What went well?
- Defining shared TypeScript types in `/shared` before writing new endpoints (action item from Sprint 1) prevented several type mismatches between the client and server.
- The tag normalization utility being shared across client validation and the backend service caught an edge case where the frontend was sending un-trimmed tags.
- Splitting the couple profile into two issues (edit fields + preview page) kept PRs focused and review fast.

## What could be improved?
- A route guard gap  -  unauthenticated access to the couple profile route  -  was found during E2E testing rather than during planning. A route-guard checklist at planning time would have caught it earlier.
- Feature issue ownership was imbalanced this sprint; Heather carried most of the feature work while Edward focused on E2E. Both partners should own feature issues every sprint.

## Action Items for Next Sprint
1. At sprint planning, assign at least one feature issue to each partner alongside any E2E work.
2. Include a route-guard review step in the Definition of Done for every sprint that adds new pages or endpoints.
3. Start E2E test scaffolding in the first two days of the sprint, not after features are merged.
