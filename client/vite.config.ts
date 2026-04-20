import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// The worktree doesn't have its own node_modules installed.
// Point all resolution to the main project's workspace locations.
const mainClientModules = path.resolve(
  __dirname,
  "../../../../client/node_modules",
);
const mainRootModules = path.resolve(__dirname, "../../../../node_modules");
const mainShared = path.resolve(__dirname, "../../../../shared");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Packages that live in the main project's client/node_modules
      {
        find: /^react-router-dom(\/.*)?$/,
        replacement: path.join(mainClientModules, "react-router-dom$1"),
      },
      {
        find: /^react-router(\/.*)?$/,
        replacement: path.join(mainClientModules, "react-router$1"),
      },
      {
        find: /^react-dom(\/.*)?$/,
        replacement: path.join(mainClientModules, "react-dom$1"),
      },
      {
        find: /^react(\/.*)?$/,
        replacement: path.join(mainClientModules, "react$1"),
      },
      {
        find: "@testing-library/react",
        replacement: path.join(mainClientModules, "@testing-library/react"),
      },
      // Packages that live in the main project's root node_modules
      {
        find: "@testing-library/user-event",
        replacement: path.join(
          mainRootModules,
          "@testing-library/user-event",
        ),
      },
      {
        find: "@testing-library/jest-dom",
        replacement: path.join(
          mainRootModules,
          "@testing-library/jest-dom",
        ),
      },
      // Shared types/utils folder (not present in the worktree)
      {
        find: /^\.\.\/\.\.\/\.\.\/shared(\/.*)?$/,
        replacement: `${mainShared}$1`,
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
