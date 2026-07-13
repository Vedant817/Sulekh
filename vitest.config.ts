import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests live in tests/unit and alongside source as *.test.ts.
    // Playwright specs in tests/e2e are excluded (run via `pnpm test:e2e`).
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "src/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    environment: "node",
    // Real Supabase integration calls include network + transaction latency.
    // Unit tests remain fast, while live-service assertions get an honest
    // budget instead of inheriting Vitest's local-only 5 second default.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
