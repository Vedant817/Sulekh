import { describe, expect, it } from "vitest";

import { gapAction } from "@/app/(workspace)/workspace/[projectId]/gaps/gap-navigation";

const MISSING = {
  flagType: "missing",
  sectionKey: "capital-structure",
  fieldKey: "CS-04",
};

describe("role-aware gap navigation", () => {
  it("sends a promoter to issuer setup with gap context", () => {
    const action = gapAction("project-1", MISSING, false);

    expect(action.label).toBe("Add missing issuer details");
    expect(action.href).toBe(
      "/workspace/project-1/intake?from=gaps&section=capital-structure&requirement=CS-04&focus=details#details",
    );
    expect(action.guidance).toMatch(/regenerate/i);
  });

  it("sends an intermediary to the highlighted review section", () => {
    const action = gapAction("project-1", MISSING, true);

    expect(action.label).toBe("Review highlighted section");
    expect(action.href).toBe(
      "/workspace/project-1/review?from=gaps&section=capital-structure&requirement=CS-04#capital-structure",
    );
    expect(action.guidance).toMatch(/highlighted/i);
  });

  it("explains that a promoter must correct inconsistent source values", () => {
    const action = gapAction(
      "project-1",
      { flagType: "inconsistent", sectionKey: "capital-structure", fieldKey: null },
      false,
    );

    expect(action.label).toBe("Correct source values");
    expect(action.href).toContain("#review");
    expect(action.guidance).toMatch(/reconfirm/i);
  });
});
