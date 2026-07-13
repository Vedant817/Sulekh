import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the end-to-end happy path (task 7.1). Runs against a
 * deployed (or locally-served) instance backed by real services. Set:
 *   E2E_BASE_URL       — the app URL (e.g. the Vercel preview)
 *   E2E_PROMOTER_EMAIL / E2E_PROMOTER_PASSWORD — a seeded promoter login
 * The spec skips itself when these are absent, so CI without live services stays green.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 600_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
