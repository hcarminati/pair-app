# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a two-package repo (no workspace manager) with independently managed `client/` and `server/` directories. They do not share dependencies or build tooling at the root level.

- **`client/`** — React 18 SPA using Vite 8, TypeScript, and `react-router-dom` v6. Entry point: `src/main.tsx`.
- **`server/`** — Express 5 API using TypeScript. Entry point: `src/index.ts`. Currently exposes a single `GET /health` endpoint on port 3000.

All commands below must be run from within the respective `client/` or `server/` directory.

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
