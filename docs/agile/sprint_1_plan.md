# Sprint 1 Planning

**Sprint Goal:** Establish the foundational architecture, set up the database schema, and implement core authentication and partner-linking.
**Dates:** March 23, 2026  -  April 7, 2026

## Planned Tickets/User Stories
1. **[[Issue #7]](https://github.com/hcarminati/pair-app/issues/7)**: Set Up GitHub Actions CI/CD Pipeline - *Assigned to: hcarminati*
2. **[[Issue #8]](https://github.com/hcarminati/pair-app/issues/8)**: Supabase Schema Migration & Seed - *Assigned to: edwardchanneu*
3. **[[Issue #4]](https://github.com/hcarminati/pair-app/issues/4)**: User Registration & Login  -  Backend - *Assigned to: edwardchanneu*
4. **[[Issue #5]](https://github.com/hcarminati/pair-app/issues/5)**: Invite Token Generation & Partner Linking - *Assigned to: hcarminati*
5. **[[Issue #12]](https://github.com/hcarminati/pair-app/issues/12)**: Fixing Linting in Dev - *Assigned to: edwardchanneu*
6. **[[Issue #15]](https://github.com/hcarminati/pair-app/issues/15)**: Prevent User from Redeeming Their Own Invite Token - *Assigned to: hcarminati*
7. **[[Issue #6]](https://github.com/hcarminati/pair-app/issues/6)**: E2E Tests  -  Auth & Partner Linking - *Assigned to: edwardchanneu*

## Risks and Mitigations
- **Risk**: JWT verification in Express middleware may not align with Supabase Auth's token format.
  - **Mitigation**: Reference Supabase JWT documentation early and write a focused middleware unit test before integrating with routes.
- **Risk**: Invite tokens need to be single-use and time-limited  -  incorrect state handling could allow reuse or self-redemption.
  - **Mitigation**: Enforce token expiry and ownership checks at the service layer, not in the route handler; add a guard test for the self-redemption case.
