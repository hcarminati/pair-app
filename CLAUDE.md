# CLAUDE.md

@import "./docs/pair-prd.md"

## Project Overview

Pair is a couples-only friend-matching web app. The unit of identity is a **couple** (two linked user accounts), not an individual. All connection logic enforces dual-consent at every stage.

## Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript + React Router v6 |
| Backend | Node.js + Express |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth — JWTs verified in Express middleware |
| Real-time | Supabase Realtime (chat threads) |
| Testing | Vitest + React Testing Library (unit/integration), Playwright (E2E) |
| Hosting | Vercel (frontend), Render (backend) |

## Architecture

```
/client          React + TypeScript SPA
  /src
    /components  Shared UI components
    /pages       Route-level page components
    /hooks       Custom React hooks
    /lib         API client, Supabase client, helpers
/server          Express API
  /routes        REST route handlers
  /middleware    Auth (JWT verification), error handling
  /services      Business logic (connection state machine, token logic)
  /db            Supabase query helpers
/shared          Types shared between client and server
/e2e             Playwright tests
```

- **`client/`** — React 18 SPA using Vite 8, TypeScript, and `react-router-dom` v6. Entry point: `src/main.tsx`. Deployed to Vercel.
- **`server/`** — Express 5 REST API using TypeScript. Entry point: `src/index.ts`. Runs on port 3000. Deployed to Render.
- **Database** — Supabase Postgres. The backend connects using the service role key (bypasses RLS). All authorization is enforced in Express route handlers — the frontend never holds the service role key.
- **Auth** — Supabase Auth issues JWTs; Express middleware verifies them on every protected route.
- **Real-time** — Supabase Realtime, subscribed to from the frontend directly (powers the four-person chat thread on connected couples).

**Key architectural rules:**
- The backend connects to Supabase using the **service role key** — RLS is bypassed; all access control is enforced in route handlers.
- The frontend **never** holds the service role key. It only calls the Express API.
- Supabase Realtime is subscribed to directly from the frontend (chat only).

## Data Model (key tables)
- `profiles` — extends `auth.users`; has `partner_id` (null until linked), `about_me` (individual bio, nullable), `location` (individual location, nullable — e.g. "Portland, OR")
- `pairs` — couple-level record created on linking; has `profile_id_1`, `profile_id_2`, `about_us` (shared couple bio, nullable), `location` (shared couple location, nullable). Deleted by backend on delink; also cascades if either profile is deleted.
- `invite_tokens` — single-use partner-linking tokens; expire 72h after creation
- `tags` / `user_tags` — tags at the individual level, unioned at the couple level
- `connection_requests` — status: `INTEREST_PENDING | INTEREST_ALIGNED | REQUEST_PENDING | CONNECTED | DECLINED`; stores all 4 participant IDs (`couple_1_user_a/b`, `couple_2_user_a/b`)
- `connection_request_participants` — per-user `interested` bool (4 rows per request)
- `messages` — linked to a `connection_request` (the chat thread); Realtime-enabled

> **Note on location:** Both `profiles.location` (individual) and `pairs.location` (shared) are plain text columns — no map or geolocation logic in v1. `pairs.location` is what displays on the discover card. This overrides FR-TAG-04 in the PRD.

**Connection state machine:**
```
INTEREST_PENDING  → one partner expressed interest; waiting on the other
INTEREST_ALIGNED  → both partners aligned; request dispatched to couple 2
REQUEST_PENDING   → couple 2 received request; awaiting both responses
CONNECTED         → all four accepted
DECLINED          → vetoed at any stage
```
Transitions are enforced **only in the Express backend**, never in client code.

## Coding Conventions
- **TypeScript strict mode** — no `any`; define shared types in `/shared`
- **Named exports** for components and utilities; default exports for page components only
- **Async/await** throughout — no raw `.then()` chains
- **Error handling** — all Express routes use a central error-handling middleware; never `res.send` raw errors
- **Tag normalization** — always lowercase + trim before insert; enforced in a shared util used by both client validation and backend
- File naming: `PascalCase` for components, `camelCase` for hooks/utils

## Testing Strategy
- **Write tests before implementation (TDD)** — red → green → refactor
- Unit tests live alongside source files (`*.test.ts`)
- Integration tests cover API routes with a test Supabase instance live alongside source files
- Playwright E2E covers the critical flows: onboarding, partner linking, discovery, connection request (both stages), chat
- Target: ≥ 80% coverage on unit + integration
- Run all tests before every commit: `npm run test`

## Do's ✅
- Enforce dual-consent in the backend service layer, not in route handlers directly
- Check for existing connection requests (any direction, any status) before creating a new one (FR-CONN-09)
- Normalize tags (lowercase + trim) at the service layer, not just the UI
- Use Supabase Realtime only for chat — all other data fetches go through Express
- Keep couple-level logic (tag union, visibility rules) in dedicated service functions

## Don'ts ❌
- Don't expose the Supabase service role key to the frontend — ever
- Don't let the frontend transition connection states directly — always go through the Express API
- Don't skip the duplicate-request check before inserting a new `connection_requests` row
- Don't show which partner declined a request to the requesting couple (FR-CONN-08 / privacy requirement)
- Don't surface incomplete couple profiles (one partner unregistered) in the discovery feed
- Don't add map or geolocation logic — location is a plain text field on both `profiles` (individual) and `pairs` (shared) in v1

## Commands

### Root (from project root)

```bash
npm run dev:client          # Start client dev server
npm run dev:server          # Start server with live reload
npm run format              # Format all files with Prettier
npm run format:check        # Check formatting without writing
npm run lint                # Lint client and server
npm run test                # Run all tests (client + server)
npm run test:client         # Run client tests only
npm run test:server         # Run server tests only
```

### Client (`cd client`)

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check + production build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview production build locally
npm test           # Run all tests once (vitest run)
```

### Server (`cd server`)

```bash
npm run dev        # Start server with live reload (tsx watch src/index.ts)
npm run build      # Compile TypeScript to dist/ (tsc)
npm start          # Run compiled server (node dist/index.js)
npm test           # Run all tests once (vitest run)
```

### Running a single test

Both `client` and `server` use Vitest. Pass a filename pattern:

```bash
npm test -- src/App.test.tsx          # client example
npm test -- src/index.test.ts         # server example
```

## Key Business Rules (quick reference)
1. A couple is "complete" only when both partners have registered **and** linked via invite token.
2. Invite tokens are single-use and expire after 72 hours.
3. If one partner delinks, the other's account is suspended and all shared requests/messages are deleted.
4. Max 10 tags per user; couple profile displays up to 20 (union).
5. Discovery feed ranks by shared tag count (descending); excludes own couple, already-connected couples, and incomplete couples.
6. A connection request is only sent to couple 2 after **both** partners of couple 1 have set `interested = true`.