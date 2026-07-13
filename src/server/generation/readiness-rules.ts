import { DOC_TYPE_ENTITIES } from "@/schemas/extraction";
import { intakeProgress, type Answers } from "@/server/intake/questionnaire";

export type ReadinessIssue = {
  focus: "details" | "documents" | "review";
  message: string;
};

export type GenerationReadiness = {
  ready: boolean;
  issues: ReadinessIssue[];
};

export function assessGenerationReadiness(input: {
  answers: Answers;
  documents: { doc_type: string; parse_status: string }[];
  entities: { confirmed_by_promoter: boolean }[];
}): GenerationReadiness {
  const issues: ReadinessIssue[] = [];
  const progress = intakeProgress(input.answers);
  if (!progress.complete) {
    issues.push({
      focus: "details",
      message: `Complete ${progress.missingRequired.length} required issuer answer${progress.missingRequired.length === 1 ? "" : "s"}.`,
    });
  }

  if (input.documents.length === 0) {
    issues.push({
      focus: "documents",
      message: "Upload the source documents supporting the issuer particulars.",
    });
  }

  const extractable = input.documents.filter(
    (document) => (DOC_TYPE_ENTITIES[document.doc_type] ?? []).length > 0,
  );
  const failed = extractable.filter((document) => document.parse_status === "failed").length;
  const unfinished = extractable.filter((document) =>
    document.parse_status === "pending" || document.parse_status === "parsing",
  ).length;
  if (failed > 0) {
    issues.push({
      focus: "documents",
      message: `Retry extraction for ${failed} source document${failed === 1 ? " that needs" : "s that need"} attention.`,
    });
  } else if (unfinished > 0) {
    issues.push({
      focus: "documents",
      message: `Finish extraction for ${unfinished} source document${unfinished === 1 ? "" : "s"}.`,
    });
  }

  if (input.entities.length === 0) {
    issues.push({
      focus: "review",
      message: "Extract and review at least one source-grounded value.",
    });
  } else {
    const unconfirmed = input.entities.filter((entity) => !entity.confirmed_by_promoter).length;
    if (unconfirmed > 0) {
      issues.push({
        focus: "review",
        message: `Confirm or correct ${unconfirmed} extracted value${unconfirmed === 1 ? "" : "s"} before drafting.`,
      });
    }
  }

  return { ready: issues.length === 0, issues };
}
