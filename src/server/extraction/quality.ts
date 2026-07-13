import type { ExtractionEntityType } from "@/schemas/extraction";

/**
 * Reject model candidates that lack the minimum source identity needed to be
 * meaningful. This is deliberately deterministic and runs after schema
 * validation, before any candidate reaches promoter review or persistence.
 */
export function hasMinimumEntityIdentity(
  entityType: ExtractionEntityType,
  data: unknown,
): boolean {
  if (entityType !== "financial_line_item") return true;
  if (!data || typeof data !== "object") return false;

  const row = data as { statement?: unknown; period_label?: unknown; line_item?: unknown };
  return (
    typeof row.statement === "string" &&
    row.statement.length > 0 &&
    typeof row.period_label === "string" &&
    row.period_label.trim().length > 0 &&
    typeof row.line_item === "string" &&
    row.line_item.trim().length > 0
  );
}
