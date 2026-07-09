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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
