import { describe, expect, it } from "vitest";

import { assessGenerationReadiness } from "@/server/generation/readiness-rules";
import { visibleQuestions, type Answers, type Question } from "@/server/intake/questionnaire";

function valueFor(question: Question): unknown {
  if (question.type === "boolean") return false;
  if (question.type === "number" || question.type === "currency") return 1;
  if (question.type === "date") return "2025-01-01";
  if (question.type === "select") return question.options?.[0]?.value;
  return "Provided";
}

function completeAnswers(): Answers {
  const answers: Answers = {};
  let added = true;
  while (added) {
    added = false;
    for (const question of visibleQuestions(answers)) {
      if (question.required && answers[question.id] === undefined) {
        answers[question.id] = valueFor(question);
        added = true;
      }
    }
  }
  return answers;
}

describe("assessGenerationReadiness", () => {
  it("blocks generation while an uploaded extractable document has failed", () => {
    const result = assessGenerationReadiness({
      answers: completeAnswers(),
      documents: [{ doc_type: "audited_financials", parse_status: "failed" }],
      entities: [],
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          focus: "documents",
          message: "Retry extraction for 1 source document that needs attention.",
        }),
        expect.objectContaining({ focus: "review", message: expect.stringContaining("at least one") }),
      ]),
    );
  });

  it("blocks generation until every extracted value is promoter-confirmed", () => {
    const result = assessGenerationReadiness({
      answers: completeAnswers(),
      documents: [{ doc_type: "audited_financials", parse_status: "parsed" }],
      entities: [{ confirmed_by_promoter: true }, { confirmed_by_promoter: false }],
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual({
      focus: "review",
      message: "Confirm or correct 1 extracted value before drafting.",
    });
  });

  it("allows generation after intake, upload, extraction, and confirmation", () => {
    expect(
      assessGenerationReadiness({
        answers: completeAnswers(),
        documents: [{ doc_type: "audited_financials", parse_status: "parsed" }],
        entities: [{ confirmed_by_promoter: true }],
      }),
    ).toEqual({ ready: true, issues: [] });
  });
});
