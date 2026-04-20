# Sprint 2 Planning

**Sprint Goal:** Give each user an editable individual profile, wire up tag selection in the registration flow, and build the couple profile so that shared interests are surfaced correctly on the discovery feed.
**Dates:** April 8, 2026  -  April 19, 2026

## Planned Tickets/User Stories
1. **[[Issue #18]](https://github.com/hcarminati/pair-app/issues/18)**: Individual Profile Page & Edit - *Assigned to: hcarminati*
2. **[[Issue #17]](https://github.com/hcarminati/pair-app/issues/17)**: Wire Up Tag Selection in Registration Flow - *Assigned to: hcarminati*
3. **[[Issue #19]](https://github.com/hcarminati/pair-app/issues/19)**: Couple Profile  -  Edit Shared Fields - *Assigned to: edwardchanneu*
4. **[[Issue #20]](https://github.com/hcarminati/pair-app/issues/20)**: Couple Profile  -  Preview Page - *Assigned to: edwardchanneu*
5. **[[Issue #21]](https://github.com/hcarminati/pair-app/issues/21)**: E2E Tests  -  Profiles & Tags - *Assigned to: edwardchanneu*

## Risks and Mitigations
- **Risk**: Tag normalization (lowercase + trim) needs to be consistent between the client validation and the backend service  -  any divergence could allow duplicate tags to be stored.
  - **Mitigation**: Implement a single shared normalization util in `/shared` used by both sides; enforce it in the service layer, not just the UI.
- **Risk**: Couple profile data is split between `profiles` (individual fields) and `pairs` (shared fields)  -  unclear ownership could cause display bugs on the preview page.
  - **Mitigation**: Agree up front that `pairs.location` overrides `profiles.location` for the discover card, and document it in the data model before writing any UI.
