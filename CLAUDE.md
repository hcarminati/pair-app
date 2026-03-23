# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

**Pair** is a couples-only social app where the unit of identity is a couple profile, not an individual. The core mechanic is dual-consent: a connection between two couples only confirms when *both* partners in each couple have independently opted in. Either partner can veto at any stage.

## Architecture

This is a two-package repo (no workspace manager) with independently managed `client/` and `server/` directories. They do not share dependencies or build tooling at the root level.

- **`client/`** — React 18 SPA using Vite 8, TypeScript, and `react-router-dom` v6. Entry point: `src/main.tsx`. Deployed to Vercel.
- **`server/`** — Express 5 REST API using TypeScript. Entry point: `src/index.ts`. Runs on port 3000. Deployed to Railway or Render.
- **Database** — Supabase Postgres. The backend connects using the service role key (bypasses RLS). All authorization is enforced in Express route handlers — the frontend never holds the service role key.
- **Auth** — Supabase Auth issues JWTs; Express middleware verifies them on every protected route.
- **Real-time** — Supabase Realtime, subscribed to from the frontend directly (powers the four-person chat thread on connected couples).

All commands below must be run from within the respective `client/` or `server/` directory.

## Connection State Machine

Connection requests move through these states, enforced in the backend:

```
INTEREST_PENDING   → One partner of couple 1 has expressed interest; waiting for the other
INTEREST_ALIGNED   → Both partners of couple 1 interested; request dispatched to couple 2
REQUEST_PENDING    → Couple 2 has received the request; awaiting both partners' responses
CONNECTED          → All four parties accepted
DECLINED           → Any partner vetoed at stage 1 or stage 2
```

Key rules:
- The backend rejects creating a new request if any request already exists between two couples in any direction/status.
- Which partner declined is never disclosed to the requesting couple.
- If a couple dissolves (partner delinks), all their connection requests and messages are deleted.

## Data Model

```sql
profiles                  -- extends Supabase auth.users
  id, display_name, partner_id (null until linked)

tags                      -- normalized lowercase, trimmed; max 10 per user
  id, label, is_custom

user_tags                 -- join table: tags applied at individual level, unioned at couple level
  user_id, tag_id

connection_requests
  id, status (PENDING | CONNECTED | DECLINED)

connection_request_participants   -- one row per user (all 4) per request
  request_id, user_id, interested (bool)

messages                  -- scoped to a connection_request; visible to all 4 participants
  id, request_id, sender_id, content, created_at
```

State transition rules: `PENDING → CONNECTED` when all four `interested = true`; any `interested = false` → `DECLINED`.

## Commands

### Client (`cd client`)

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check + production build (tsc -b && vite build)
npm run lint       # ESLint
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

## Testing

- **Client**: Vitest with `jsdom` environment and `@testing-library/react`.
- **Server**: Vitest only — no DOM environment. Test files live in `server/src/` alongside source files.
- **E2E**: Playwright covers critical user flows (not yet scaffolded).
