# pair-app

[![CI](https://github.com/hcarminati/pair-app/actions/workflows/ci.yml/badge.svg)](https://github.com/hcarminati/pair-app/actions/workflows/ci.yml)
[![Playwright E2E Tests](https://github.com/hcarminati/pair-app/actions/workflows/e2e.yml/badge.svg)](https://github.com/hcarminati/pair-app/actions/workflows/e2e.yml)

**Live app:** https://pair-app.netlify.app

This project is a monorepo containing a `client` and a `server` application. It uses npm workspaces to manage dependencies across both projects.

## Prerequisites

- Node.js
- npm

## Setup

1. Install dependencies from the root of the project. This will install dependencies for both the `client` and `server` workspaces.
   ```bash
   npm install
   ```

## Supabase Setup

1. Create a Supabase project and enable **Email** authentication (Authentication → Providers).
2. Go to the **SQL Editor** and run `project-memory/database-setup.sql` to create the schema, seed preset tags, and register the E2E test cleanup function.
3. Set up environment variables:

   **Server** (`server/.env`) — backend only, never expose these to the client:
   ```bash
   cp server/.env.example server/.env
   ```
   - `SUPABASE_URL` — found on the **Project Overview** homepage
   - `SUPABASE_SECRET_KEY` — found under **Project Settings → API Keys** (secret key)
   - `SUPABASE_ANON_KEY` — found under **Project Settings → API Keys** (publishable key)

   **Client** (`client/.env`) — used for Supabase Realtime and E2E test auth:
   ```bash
   cp client/.env.example client/.env
   ```
   - `VITE_SUPABASE_URL` — same Supabase project URL as above
   - `VITE_SUPABASE_ANON_KEY` — same Supabase project publishable key as above

## Database

The schema, seed data, and E2E test helper function are all in `project-memory/database-setup.sql`.

To set up the database, paste the contents of that file into the **Supabase Studio SQL Editor** and run it. This creates all tables, seeds preset tags, and registers two functions:

- `link_partners(user_a, user_b)` — atomically links two profiles and creates the `pairs` row in a single transaction; called by the Express backend via `supabase.rpc()`
- `unlink_partners(user_a, partner)` — atomically unlinks two profiles, deletes the `pairs` row, and removes all shared connection requests (cascades to participants and messages); called by the Express backend via `supabase.rpc()`
- `delete_test_user()` — E2E test cleanup (see below)

### E2E Test Cleanup

E2E test users are created with emails matching `test_e2e_%@example.com`. After a test run, each test user calls `delete_test_user()` to self-delete using their own JWT — no service role key required:

```sql
SELECT delete_test_user();
```

The function only allows deletion of accounts whose email matches `test_e2e_%@example.com` and handles cascade cleanup of all associated data.

> **Running the Express server** requires a `.env` with `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_ANON_KEY` from your Supabase project settings.

## Development

You can run the development servers from the root directory:

- **Start Client:**
  ```bash
  npm run dev:client
  ```
  *(Note: `npm run dev` also runs the client by default)*

- **Start Server:**
  ```bash
  npm run dev:server
  ```

*It is recommended to run the client and server in separate terminal windows during development.*

## Formatting and Linting

- **Format Code:** Automatically formats code across the project using Prettier.
  ```bash
  npm run format
  ```
- **Check Formatting:** 
  ```bash
  npm run format:check
  ```
- **Lint Code:** Runs ESLint on both client and server code.
  ```bash
  npm run lint
  ```

## Testing

- **Run All Tests:**
  ```bash
  npm run test
  ```
- **Run Client Tests:**
  ```bash
  npm run test:client
  ```
- **Run Server Tests:**
  ```bash
  npm run test:server
  ```

### E2E Tests (Playwright)

E2E tests require both the client and server to be running. The test runner starts them automatically via `webServer` in `playwright.config.ts`, so you don't need to start them manually.

Before running E2E tests, ensure `client/.env` has the following set:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — required for all E2E tests
- `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` — a pre-seeded Supabase user for the "valid login" test; if omitted that test is skipped

- **Run E2E tests (headed — browser visible):**
  ```bash
  npm run test:e2e
  ```
- **Run E2E tests (headless — mirrors CI):**
  ```bash
  npm run test:e2e:headless
  ```
- **View the last test report:**
  ```bash
  npm run test:e2e:report
  ```

E2E tests create users with emails matching `test_e2e_%@example.com` and clean them up automatically via `afterAll` hooks using the `delete_test_user()` Supabase function.

#### GitHub Actions secrets

The E2E workflow (`.github/workflows/e2e.yml`) requires the following secrets set under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server only) |
| `TEST_USER_EMAIL` | Pre-seeded test user email (optional — skips valid-login test if absent) |
| `TEST_USER_PASSWORD` | Pre-seeded test user password (optional — skips valid-login test if absent) |
