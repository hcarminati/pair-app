# pair-app

This project is a monorepo containing a `client` and a `server` application. It uses npm workspaces to manage dependencies across both projects.

## Prerequisites

- Node.js
- npm

## Setup

1. Install dependencies from the root of the project. This will install dependencies for both the `client` and `server` workspaces.
   ```bash
   npm install
   ```

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
