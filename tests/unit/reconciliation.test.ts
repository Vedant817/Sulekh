import { describe, expect, it } from "vitest";

import { reconcile, type ReconInput } from "@/server/gaps/reconciliation";

const consistent: ReconInput = {
  intake: { faceValue: 10, preIssueShares: 1_000_000, freshIssueAmount: 500, netWorth: 800 },
  capTable: [
    { holder: "Promoter A", shares: 600_000, percentage: 60 },
    { holder: "Promoter B", shares: 400_000, percentage: 40 },
  ],
  capitalStructure: { preIssueCapital: 10_000_000 },
  offer: { objects: [{ label: "Capex", amount: 300 }, { label: "GCP", amount: 200 }], freshIssueAmount: 500 },
};

describe("cross-section reconciliation", () => {
  it("passes clean on internally consistent data", () => {
    expect(reconcile(consistent)).toEqual([]);
  });

  it("flags cap-table shares that disagree with stated pre-issue shares", () => {
    const bad = { ...consistent, capTable: [{ holder: "A", shares: 900_000, percentage: 100 }] };
    const findings = reconcile(bad);
    const f = findings.find((x) => x.code === "RECON-SHARES");
    expect(f).toBeDefined();
    expect(f!.severity).toBe("blocker");
    expect(f!.sections).toContain("capital-structure");
    expect(f!.sections).toContain("general-information");
  });

  it("flags shareholding percentages that do not total 100%", () => {
    const bad = {
      ...consistent,
      capTable: [
        { holder: "A", shares: 600_000, percentage: 55 },
        { holder: "B", shares: 400_000, percentage: 40 },
      ],
    };
    expect(reconcile(bad).some((f) => f.code === "RECON-PCT")).toBe(true);
  });

  it("flags pre-issue capital that isn't face value × shares", () => {
    const bad = { ...consistent, capitalStructure: { preIssueCapital: 9_000_000 } };
    const f = reconcile(bad).find((x) => x.code === "RECON-CAPITAL");
    expect(f).toBeDefined();
    expect(f!.sections).toContain("capital-structure");
  });

  it("flags objects that don't foot to the fresh issue amount", () => {
    const bad = {
      ...consistent,
      offer: { objects: [{ label: "Capex", amount: 300 }], freshIssueAmount: 500 },
    };
    const f = reconcile(bad).find((x) => x.code === "RECON-OBJECTS");
    expect(f).toBeDefined();
    expect(f!.sections).toContain("objects-of-issue");
  });
});
