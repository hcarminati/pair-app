# Daily Standup Updates

**Project:** Pair — Couples Friend-Matching App
**Team:** Heather Carminati & Edward Channeu

---

## Sprint 1 (Auth, Partner Linking, CI/CD)

**March 24, 2026**
* **Heather Carminati:**
  * Yesterday: Sprint start.
  * Today: Setting up the GitHub Actions CI/CD pipeline (Issue #7) — lint + test checks on push to `develop`.
  * Blockers: None.
* **Edward Channeu:**
  * Yesterday: Sprint start.
  * Today: Drafting the Supabase schema migration for `profiles`, `pairs`, and `invite_tokens` tables (Issue #8).
  * Blockers: None.

**March 30, 2026**
* **Heather Carminati:**
  * Yesterday: CI/CD pipeline done (#7); started invite token generation and the partner-linking backend (#5).
  * Today: Finishing token redemption logic and wiring up the partner-linking UI; adding self-redemption guard (Issue #15).
  * Blockers: Need Edward's `profiles` schema finalized before I can test the linking insert.
* **Edward Channeu:**
  * Yesterday: Schema migration and seed script complete (#8); started registration and login backend (#4).
  * Today: Finishing login endpoint and JWT middleware; fixing linting config (Issue #12).
  * Blockers: Minor — verifying our JWT extraction matches what the Supabase Auth session returns.

**April 5, 2026**
* **Heather Carminati:**
  * Yesterday: Partner-linking flow end-to-end complete (#5) — token generation, redemption, and `partner_id` update all working; self-redemption guard added (#15).
  * Today: Final review pass and writing integration tests for the token endpoints.
  * Blockers: None.
* **Edward Channeu:**
  * Yesterday: Registration and login backend fully wired (#4); auth middleware verifying JWTs on all protected routes.
  * Today: Writing Playwright E2E tests for the auth and partner-linking flows (Issue #6).
  * Blockers: None.

---

## Sprint 2 (Profiles, Tags, Couple Profile)

**April 9, 2026**
* **Heather Carminati:**
  * Yesterday: Wrapped up Sprint 1 review; reviewed Figma wireframes for profile pages.
  * Today: Scaffolding the `ProfilePage` component and individual profile edit form — bio, location, and display name (Issue #18).
  * Blockers: None.
* **Edward Channeu:**
  * Yesterday: Wrapped up Sprint 1 E2E tests (#6); reviewed `tags` and `user_tags` schema.
  * Today: Starting couple profile shared fields (Issue #19) and setting up Playwright page objects for profile E2E tests (Issue #21).
  * Blockers: Profile routes not yet merged; running against a local stub for now.

**April 13, 2026**
* **Heather Carminati:**
  * Yesterday: Individual profile page and edit flow done (#18) — fields saving to `profiles` via Express.
  * Today: Wiring up tag selection in the registration flow (Issue #17); enforcing normalization in the service layer.
  * Blockers: Confirming with Edward that `pairs.location` overrides `profiles.location` on the discover card — resolving now, updating type in `/shared`.
* **Edward Channeu:**
  * Yesterday: Couple profile shared fields mostly done (#19); flagged a route guard gap — unauthenticated users could access the couple profile route.
  * Today: Finishing couple profile edit (#19) and preview page (Issue #20); fixing the route guard issue.
  * Blockers: Need the route guard fix merged before couple profile E2E tests can run end-to-end.

**April 17, 2026**
* **Heather Carminati:**
  * Yesterday: Tag selection wired up and persisting to `user_tags` with normalization (#17).
  * Today: Final review pass on all issues; helping Edward with any E2E edge cases.
  * Blockers: None.
* **Edward Channeu:**
  * Yesterday: Couple profile edit (#19) and preview page (#20) done; route guard fixed.
  * Today: Finishing Playwright E2E tests for profile edit and tag selection flows (Issue #21) — one flaky test on the interest chips render; adding `waitFor` to stabilize.
  * Blockers: None.
