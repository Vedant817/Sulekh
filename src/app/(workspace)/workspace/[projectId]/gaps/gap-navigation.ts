export type GapNavigationInput = {
  flagType: string;
  sectionKey: string | null;
  fieldKey: string | null;
};

export type GapAction = { href: string; label: string; guidance: string };

/** Give each role a destination where it can actually take the next action. */
export function gapAction(
  projectId: string,
  gap: GapNavigationInput,
  canReview: boolean,
): GapAction {
  const params = new URLSearchParams({ from: "gaps" });
  if (gap.sectionKey) params.set("section", gap.sectionKey);
  if (gap.fieldKey) params.set("requirement", gap.fieldKey);

  if (canReview) {
    return {
      href: `/workspace/${projectId}/review?${params.toString()}${gap.sectionKey ? `#${gap.sectionKey}` : ""}`,
      label: gap.flagType === "inconsistent" ? "Review inconsistency" : "Review highlighted section",
      guidance:
        gap.flagType === "inconsistent"
          ? "Inspect the highlighted section, request a source-data correction, then re-run checks."
          : "The affected section will be highlighted. Edit it or request changes, then re-run checks.",
    };
  }

  const target = gap.flagType === "inconsistent" ? "review" : "details";
  params.set("focus", target);
  return {
    href: `/workspace/${projectId}/intake?${params.toString()}#${target}`,
    label: gap.flagType === "inconsistent" ? "Correct source values" : "Add missing issuer details",
    guidance:
      gap.flagType === "inconsistent"
        ? "Correct and reconfirm the source values, regenerate the draft, then re-run checks."
        : "Add or correct the issuer facts, regenerate the draft, then re-run checks.",
  };
}
