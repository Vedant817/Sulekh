/**
 * Cross-section reconciliation. Independent, deterministic consistency checks
 * over the issuer's confirmed structured data — catching figures that disagree
 * across the capital structure, financials, and offer. Each finding names the
 * conflicting sources so it is actionable. Pure and fully unit-testable.
 */

export type ReconInput = {
  intake: {
    faceValue?: number | null;
    preIssueShares?: number | null;
    freshIssueAmount?: number | null;
    netWorth?: number | null;
  };
  /** Confirmed cap-table rows (shares + percentage of total). */
  capTable: { holder: string; shares?: number | null; percentage?: number | null }[];
  /** Populated capital_structure row, if any. */
  capitalStructure?: { preIssueCapital?: number | null } | null;
  /** Offer objects with deployment amounts, and the fresh-issue total. */
  offer?: { objects: { label: string; amount?: number | null }[]; freshIssueAmount?: number | null } | null;
};

export type ReconFinding = {
  code: string;
  severity: "warning" | "blocker";
  sections: string[];
  message: string;
  details: Record<string, unknown>;
};

/** Relative tolerance for numeric agreement (rounding, unit noise). */
const REL_TOL = 0.01;

function disagree(a: number, b: number): boolean {
  if (a === 0 && b === 0) return false;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) > REL_TOL;
}

function sum(nums: (number | null | undefined)[]): number {
  return nums.reduce<number>((acc, n) => acc + (typeof n === "number" ? n : 0), 0);
}

export function reconcile(input: ReconInput): ReconFinding[] {
  const findings: ReconFinding[] = [];

  // 1. Cap-table shares must total the stated pre-issue share count.
  const hasShares = input.capTable.some((r) => typeof r.shares === "number");
  if (hasShares && typeof input.intake.preIssueShares === "number") {
    const total = sum(input.capTable.map((r) => r.shares));
    if (disagree(total, input.intake.preIssueShares)) {
      findings.push({
        code: "RECON-SHARES",
        severity: "blocker",
        sections: ["capital-structure", "general-information"],
        message: `Cap-table shares (${total.toLocaleString("en-IN")}) do not match the stated pre-issue shares (${input.intake.preIssueShares.toLocaleString("en-IN")}).`,
        details: { capTableShares: total, intakePreIssueShares: input.intake.preIssueShares },
      });
    }
  }

  // 2. Shareholding percentages should total ~100%.
  const pcts = input.capTable.map((r) => r.percentage).filter((p): p is number => typeof p === "number");
  if (pcts.length > 0) {
    const totalPct = sum(pcts);
    if (Math.abs(totalPct - 100) > 0.5) {
      findings.push({
        code: "RECON-PCT",
        severity: "warning",
        sections: ["capital-structure"],
        message: `Shareholding percentages total ${totalPct.toFixed(2)}%, not 100%.`,
        details: { totalPct },
      });
    }
  }

  // 3. Derived pre-issue paid-up capital vs any populated capital_structure figure.
  if (
    typeof input.intake.faceValue === "number" &&
    typeof input.intake.preIssueShares === "number" &&
    input.capitalStructure &&
    typeof input.capitalStructure.preIssueCapital === "number"
  ) {
    const derived = input.intake.faceValue * input.intake.preIssueShares;
    if (disagree(derived, input.capitalStructure.preIssueCapital)) {
      findings.push({
        code: "RECON-CAPITAL",
        severity: "blocker",
        sections: ["capital-structure"],
        message: `Pre-issue capital (${input.capitalStructure.preIssueCapital.toLocaleString("en-IN")}) does not equal face value × pre-issue shares (${derived.toLocaleString("en-IN")}).`,
        details: { statedPreIssueCapital: input.capitalStructure.preIssueCapital, derived },
      });
    }
  }

  // 4. Objects of the issue must foot to the fresh-issue amount.
  if (input.offer && input.offer.objects.length > 0) {
    const objTotal = sum(input.offer.objects.map((o) => o.amount));
    const fresh = input.offer.freshIssueAmount ?? input.intake.freshIssueAmount;
    if (typeof fresh === "number" && objTotal > 0 && disagree(objTotal, fresh)) {
      findings.push({
        code: "RECON-OBJECTS",
        severity: "blocker",
        sections: ["objects-of-issue"],
        message: `Objects of the issue total ${objTotal.toLocaleString("en-IN")} but the fresh issue is ${fresh.toLocaleString("en-IN")}.`,
        details: { objectsTotal: objTotal, freshIssueAmount: fresh },
      });
    }
  }

  return findings;
}
