import { describe, expect, it } from "vitest";

import {
  intakeProgress,
  validateAnswer,
  visibleQuestions,
  questionById,
  type Answers,
} from "@/server/intake/questionnaire";

function ids(answers: Answers): string[] {
  return visibleQuestions(answers).map((q) => q.id);
}

describe("intake branching", () => {
  it("manufacturing + fresh-issue profile shows manufacturing & fresh questions", () => {
    const a: Answers = { issuer_type: "manufacturing", offer_structure: "fresh_only" };
    const shown = ids(a);
    expect(shown).toContain("installed_capacity");
    expect(shown).toContain("plant_locations");
    expect(shown).toContain("fresh_issue_shares");
    expect(shown).toContain("fresh_issue_amount");
    expect(shown).toContain("objects_of_issue");
    // hidden branches
    expect(shown).not.toContain("service_lines");
    expect(shown).not.toContain("key_products_traded");
    expect(shown).not.toContain("ofs_amount");
    expect(shown).not.toContain("ofs_selling_shareholders");
  });

  it("services + OFS profile shows service & OFS questions, hides the rest", () => {
    const a: Answers = { issuer_type: "services", offer_structure: "ofs_only" };
    const shown = ids(a);
    expect(shown).toContain("service_lines");
    expect(shown).toContain("ofs_selling_shareholders");
    expect(shown).toContain("ofs_shares");
    expect(shown).toContain("ofs_amount");
    expect(shown).not.toContain("installed_capacity");
    expect(shown).not.toContain("fresh_issue_shares");
    expect(shown).not.toContain("fresh_issue_amount");
    expect(shown).not.toContain("objects_of_issue");
  });

  it("gating boolean reveals its follow-up question", () => {
    expect(ids({ has_litigation: false })).not.toContain("litigation_summary");
    expect(ids({ has_litigation: true })).toContain("litigation_summary");
    expect(ids({ has_contingent_liabilities: true })).toContain("contingent_details");
  });
});

describe("intake validation", () => {
  it("enforces numeric ranges", () => {
    const q = questionById("promoter_count")!;
    expect(validateAnswer(q, "3")).toEqual({ ok: true, value: 3 });
    expect(validateAnswer(q, "0").ok).toBe(false);
    expect(validateAnswer(q, "999").ok).toBe(false);
  });

  it("does not coerce a blank required number to zero", () => {
    const required = questionById("latest_revenue")!;
    expect(validateAnswer(required, "")).toEqual({
      ok: false,
      error: "Latest FY revenue from operations (₹ in lakhs) is required",
    });
  });

  it("allows price-dependent issue amounts to remain unknown", () => {
    const amount = questionById("fresh_issue_amount")!;
    expect(amount.required).not.toBe(true);
    expect(validateAnswer(amount, "")).toEqual({ ok: true, value: null });
  });

  it("rejects invalid select values and accepts valid ones", () => {
    const q = questionById("issuer_type")!;
    expect(validateAnswer(q, "manufacturing").ok).toBe(true);
    expect(validateAnswer(q, "mining").ok).toBe(false);
  });

  it("requires non-empty text for required fields with a clear message", () => {
    const q = questionById("legal_name")!;
    const res = validateAnswer(q, "   ");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Legal name/);
  });

  it("validates date format", () => {
    const q = questionById("incorporation_date")!;
    expect(validateAnswer(q, "2019-05-01").ok).toBe(true);
    expect(validateAnswer(q, "01/05/2019").ok).toBe(false);
  });
});

describe("intake progress", () => {
  it("is incomplete until all visible required questions are answered", () => {
    const partial: Answers = { issuer_type: "services", offer_structure: "ofs_only" };
    expect(intakeProgress(partial).complete).toBe(false);
    expect(intakeProgress(partial).missingRequired.length).toBeGreaterThan(0);
  });

  it("does not count hidden-branch questions as missing", () => {
    const a: Answers = { issuer_type: "manufacturing", offer_structure: "fresh_only" };
    const p = intakeProgress(a);
    expect(p.missingRequired).not.toContain("service_lines");
    expect(p.missingRequired).not.toContain("ofs_amount");
    expect(p.missingRequired).toContain("fresh_issue_shares");
  });
});
