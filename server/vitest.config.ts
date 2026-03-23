import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules", "dist"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },
});
