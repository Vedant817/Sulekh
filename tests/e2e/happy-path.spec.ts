import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * Live end-to-end journey. The caller provisions disposable, email-confirmed
 * Supabase users and passes their credentials; every application step below is
 * performed through the browser against real Storage, Groq, Postgres, RLS,
 * review, and export paths.
 */
const PROMOTER_EMAIL = process.env.E2E_PROMOTER_EMAIL;
const PROMOTER_PASSWORD = process.env.E2E_PROMOTER_PASSWORD;
const INTERMEDIARY_EMAIL = process.env.E2E_INTERMEDIARY_EMAIL;
const INTERMEDIARY_PASSWORD = process.env.E2E_INTERMEDIARY_PASSWORD;
const PROJECT_NAME = process.env.E2E_PROJECT_NAME ?? "Sulekh live E2E verification";
const configured = Boolean(
  process.env.E2E_BASE_URL &&
    PROMOTER_EMAIL &&
    PROMOTER_PASSWORD &&
    INTERMEDIARY_EMAIL &&
    INTERMEDIARY_PASSWORD,
);

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
}

async function answerNo(page: Page, questionId: string): Promise<void> {
  const field = page.locator(`#${questionId}`);
  await field.getByRole("button", { name: "No", exact: true }).click();
}

async function completeIntake(page: Page): Promise<void> {
  await page.locator("#legal_name").fill("Sulekh Verification Industries Limited (TEST)");
  await page.locator("#cin").fill("U29309MH2026PLC999999");
  await page.locator("#incorporation_date").fill("2020-01-15");
  await page.locator("#registered_office_state").fill("Maharashtra");
  await page.locator("#issuer_type").selectOption("manufacturing");
  await page.locator("#sector").selectOption("manufacturing_industrial");

  await page
    .locator("#business_description")
    .fill("Manufactures precision industrial components for automotive and engineering customers.");
  await page.locator("#installed_capacity").fill("12,000 units per annum");
  await page.locator("#plant_locations").fill("MIDC Industrial Area, Pune, Maharashtra");

  await page.locator("#promoter_names").fill("Verification Promoter One, Verification Promoter Two");
  await page.locator("#promoter_count").fill("2");
  await page.locator("#face_value").fill("10");
  await page.locator("#pre_issue_shares").fill("5000000");
  await page.locator("#offer_structure").selectOption("fresh_only");
  await page.locator("#fresh_issue_amount").fill("1500");
  await page
    .locator("#objects_of_issue")
    .fill("Production-line capital expenditure, machinery upgrades, and general corporate purposes.");

  await page.locator("#latest_revenue").fill("4200");
  await page.locator("#latest_pat").fill("360");
  await page.locator("#net_worth").fill("1850");
  await answerNo(page, "has_contingent_liabilities");
  await answerNo(page, "has_litigation");

  await expect(page.getByText("Issuer details complete", { exact: true }).last()).toBeVisible();
  await expect
    .poll(() => page.getByText("Saving…", { exact: true }).count(), { timeout: 60_000 })
    .toBe(0);
  // Next.js keeps an empty route-announcer with role=alert in the document;
  // only a non-empty alert represents a real field/server error.
  await expect(page.locator('[role="alert"]').filter({ hasText: /\S/ })).toHaveCount(0);
}

test.describe("Sulekh live journey", () => {
  test.skip(
    !configured,
    "Set E2E_BASE_URL and disposable promoter/intermediary credentials to run live services.",
  );

  test("protected workspace redirects an unauthenticated user", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });

  test("promoter setup → live extraction → generation → review → final exports", async ({
    page,
  }, testInfo) => {
    await signIn(page, PROMOTER_EMAIL!, PROMOTER_PASSWORD!);

    await page.getByLabel("New IPO project").fill(PROJECT_NAME);
    await page.getByLabel("Board").selectOption("BSE_SME");
    await page.getByRole("button", { name: "Create project" }).click();
    const projectLink = page.getByRole("link", { name: new RegExp(PROJECT_NAME) });
    await expect(projectLink).toBeVisible();
    await projectLink.click();
    await page.getByRole("link", { name: /issuer setup/i }).click();
    await expect(page.getByRole("heading", { name: /complete issuer setup/i })).toBeVisible();

    await completeIntake(page);

    const sourcePdf = path.resolve(process.cwd(), "corpus/reference-drhp-1.pdf");
    await page.locator("#files").setInputFiles(sourcePdf);
    await page.locator('select[name="docType"]').selectOption("audited_financials");
    await page.getByRole("button", { name: /upload and prepare 1/i }).click();
    await expect(page.getByText(/Upload complete\. [1-9]\d* values? extracted/i)).toBeVisible({
      timeout: 300_000,
    });
    await expect(
      page.getByRole("listitem").filter({ hasText: "reference-drhp-1.pdf" }).first(),
    ).toContainText("Extraction complete");

    await page.getByLabel(/I reviewed these values against the source snippets/i).check();
    await page.getByRole("button", { name: /Confirm \d+ reviewed values?/i }).click();
    await expect(page.getByText("Review complete", { exact: true })).toBeVisible();

    const generateButton = page.getByRole("button", { name: /generate grounded draft/i }).first();
    await expect(generateButton).toBeVisible();
    await generateButton.click();
    await expect(page).toHaveURL(/\/generate$/);
    const projectRoot = new URL(page.url()).pathname.replace(/\/generate$/, "");

    await page.getByRole("button", { name: /^Generate$/ }).click();
    await expect
      .poll(
        async () => {
          const body = await page.locator("body").innerText();
          if (/Status:\s*Failed/i.test(body)) return "failed";
          if (/Status:\s*Succeeded/i.test(body)) return "succeeded";
          return "active";
        },
        { timeout: 600_000, intervals: [2_000] },
      )
      .toBe("succeeded");
    await expect(page.getByText(/Sections \(27\)/i)).toBeVisible();

    await page.goto(`${projectRoot}/gaps`);
    await expect(page.getByRole("heading", { name: "Gaps & coverage" })).toBeVisible();
    const coverageCard = page.getByText("Coverage", { exact: true }).locator("..");
    await expect(coverageCard).toContainText(/\d+%/);
    await expect(page.getByText(/Requirement coverage \(43\)/i)).toBeVisible();

    await page.goto(projectRoot);
    await page.getByPlaceholder("intermediary@firm.com").fill(INTERMEDIARY_EMAIL!);
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Intermediary assigned.", { exact: true })).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, INTERMEDIARY_EMAIL!, INTERMEDIARY_PASSWORD!);
    await page.getByRole("link", { name: new RegExp(PROJECT_NAME) }).click();
    await page.getByRole("link", { name: /intermediary review/i }).click();
    await expect(page.getByRole("heading", { name: "Intermediary review" })).toBeVisible();

    const firstComment = page.getByPlaceholder("Add a comment…").first();
    await firstComment.fill("Live E2E evidence and grounding reviewed.");
    await page.getByRole("button", { name: "Comment", exact: true }).first().click();
    await expect(page.getByText("Live E2E evidence and grounding reviewed.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Needs changes", exact: true }).first().click();
    await expect(page.getByText("needs changes", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const firstEditor = page.locator("textarea").first();
    await firstEditor.fill(`${await firstEditor.inputValue()}\n\nIntermediary-reviewed during live E2E.`);
    await page.getByRole("button", { name: "Save edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();

    for (;;) {
      const approveButtons = page.getByRole("button", { name: "Approve", exact: true });
      const remaining = await approveButtons.count();
      if (remaining === 0) break;
      await approveButtons.first().click();
      await expect.poll(() => approveButtons.count(), { timeout: 30_000 }).toBe(remaining - 1);
    }
    await expect(page.getByText(/un-watermarked export unlocked/i)).toBeVisible();
    await expect(page.getByText(/Audit trail \([1-9]\d*\)/i)).toBeVisible();

    await page.goto(`${projectRoot}/export`);
    await expect(page.getByText(/exports are un-watermarked \(final\)/i)).toBeVisible();
    const docxResponse = await page.request.get(`${projectRoot.replace("/workspace", "/api/projects")}/export/docx`);
    expect(docxResponse.ok()).toBe(true);
    expect(docxResponse.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect((await docxResponse.body()).subarray(0, 2).toString()).toBe("PK");

    const pdfResponse = await page.request.get(`${projectRoot.replace("/workspace", "/api/projects")}/export/pdf`);
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const coverageResponse = await page.request.get(
      `${projectRoot.replace("/workspace", "/api/projects")}/coverage-report`,
    );
    expect(coverageResponse.ok()).toBe(true);
    const coverage = (await coverageResponse.json()) as { requirements?: unknown[] };
    expect(coverage.requirements).toHaveLength(43);

    await page.screenshot({ path: testInfo.outputPath("final-export.png"), fullPage: true });
  });
});
