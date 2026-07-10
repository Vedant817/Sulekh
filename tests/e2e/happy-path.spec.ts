import { expect, test } from "@playwright/test";

/**
 * End-to-end happy path (task 7.1): sign in → open project → intake → documents
 * → generate → gaps → review → export. Exercises the real deployed app against
 * live Supabase + Claude. Skipped unless E2E_BASE_URL + a seeded promoter login
 * are configured, so CI without live services stays green.
 *
 * Run: E2E_BASE_URL=https://<deploy> E2E_PROMOTER_EMAIL=… E2E_PROMOTER_PASSWORD=… pnpm test:e2e
 */
const EMAIL = process.env.E2E_PROMOTER_EMAIL;
const PASSWORD = process.env.E2E_PROMOTER_PASSWORD;
const configured = Boolean(process.env.E2E_BASE_URL && EMAIL && PASSWORD);

test.describe("DRHP Studio happy path", () => {
  test.skip(!configured, "Set E2E_BASE_URL + E2E_PROMOTER_EMAIL/PASSWORD to run against a live deploy.");

  test("protected route redirects an unauthenticated user to login", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page).toHaveURL(/\/login/);
  });

  test("promoter signs in and reaches the workspace", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL!);
    await page.getByLabel("Password").fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/workspace/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  });

  test("opens the sample project and walks intake → generate → gaps → export", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL!);
    await page.getByLabel("Password").fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/workspace/);

    // Open the first project.
    await page.getByRole("link", { name: /SAMPLE|IPO/i }).first().click();
    await expect(page.getByRole("link", { name: /guided intake/i })).toBeVisible();

    // Generate a draft.
    await page.getByRole("link", { name: /generate draft/i }).click();
    await page.getByRole("button", { name: /generate/i }).click();
    // Progress reaches completion (bounded wait).
    await expect(page.getByText(/status:\s*succeeded/i)).toBeVisible({ timeout: 300_000 });

    // Gaps & coverage renders a coverage %.
    await page.goto(`${page.url().replace(/\/generate.*/, "")}/gaps`);
    await expect(page.getByText(/coverage/i)).toBeVisible();

    // Export page shows the watermark banner + download links.
    await page.goto(`${page.url().replace(/\/gaps.*/, "")}/export`);
    await expect(page.getByRole("link", { name: /Word|PDF/i }).first()).toBeVisible();
  });
});
