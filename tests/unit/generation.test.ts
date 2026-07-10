import { describe, expect, it } from "vitest";

import {
  checkCoverage,
  parseGapMarkers,
  stripGapMarkers,
} from "@/server/generation/coverage";
import { modelKindForSection } from "@/server/generation/model-routing";
import { generationOrder, type CatalogSection } from "@/server/generation/sections";

const CATALOG: CatalogSection[] = [
  { sectionKey: "cover-page", ordinal: 1 },
  { sectionKey: "risk-factors", ordinal: 3 },
  { sectionKey: "capital-structure", ordinal: 6 },
  { sectionKey: "objects-of-issue", ordinal: 7 },
  { sectionKey: "basis-for-issue-price", ordinal: 8 },
  { sectionKey: "business-overview", ordinal: 11 },
  { sectionKey: "industry-overview", ordinal: 10 },
  { sectionKey: "financial-information", ordinal: 19 },
  { sectionKey: "mda", ordinal: 20 },
  { sectionKey: "legal-proceedings", ordinal: 21 },
];

function orderIndex(order: string[], key: string) {
  return order.indexOf(key);
}

describe("generation order (dependency-respecting)", () => {
  const order = generationOrder(CATALOG);

  it("places dependencies before dependents", () => {
    expect(orderIndex(order, "capital-structure")).toBeLessThan(
      orderIndex(order, "objects-of-issue"),
    );
    expect(orderIndex(order, "objects-of-issue")).toBeLessThan(
      orderIndex(order, "basis-for-issue-price"),
    );
    expect(orderIndex(order, "financial-information")).toBeLessThan(
      orderIndex(order, "basis-for-issue-price"),
    );
    expect(orderIndex(order, "financial-information")).toBeLessThan(
      orderIndex(order, "mda"),
    );
    expect(orderIndex(order, "business-overview")).toBeLessThan(
      orderIndex(order, "risk-factors"),
    );
  });

  it("includes every section exactly once", () => {
    expect(order.slice().sort()).toEqual(CATALOG.map((s) => s.sectionKey).sort());
  });

  it("throws on an unknown dependency", () => {
    // basis-for-issue-price depends on capital-structure & financial-information;
    // omitting one makes the dependency unknown.
    const partial = CATALOG.filter((s) => s.sectionKey !== "capital-structure");
    expect(() => generationOrder(partial)).toThrow(/unknown section/);
  });
});

describe("model routing", () => {
  it("routes reasoning-heavy sections to the reasoning model", () => {
    expect(modelKindForSection("risk-factors")).toBe("reasoning");
    expect(modelKindForSection("basis-for-issue-price")).toBe("reasoning");
    expect(modelKindForSection("mda")).toBe("reasoning");
  });
  it("routes narrative sections to the drafting model", () => {
    expect(modelKindForSection("cover-page")).toBe("drafting");
    expect(modelKindForSection("business-overview")).toBe("drafting");
  });
});

describe("gap markers", () => {
  it("parses and strips [[GAP: …]] markers", () => {
    const text = "Revenue was ₹120 lakhs. [[GAP: prior-year revenue not provided]] Growth is strong.";
    expect(parseGapMarkers(text)).toEqual(["prior-year revenue not provided"]);
    expect(stripGapMarkers(text)).not.toContain("GAP");
    expect(stripGapMarkers(text)).toContain("Revenue was");
  });
});

describe("independent coverage check", () => {
  const reqs = [
    { code: "CS-03", title: "Promoter contribution and lock-in", mandatory: true },
    { code: "CS-04", title: "Shareholding pattern", mandatory: true },
  ];

  it("confirms coverage when the topic is substantively present", () => {
    const md = "The promoter contribution and lock-in of pre-issue capital is 20% for three years.";
    const result = checkCoverage(md, reqs, ["CS-03"]);
    const cs03 = result.find((r) => r.code === "CS-03")!;
    expect(cs03.present).toBe(true);
    expect(cs03.overclaimed).toBe(false);
  });

  it("catches a requirement the model claims but the text does not cover", () => {
    const md = "The promoter contribution and lock-in is disclosed above."; // no shareholding pattern
    const result = checkCoverage(md, reqs, ["CS-03", "CS-04"]); // model claims both
    const cs04 = result.find((r) => r.code === "CS-04")!;
    expect(cs04.present).toBe(false);
    expect(cs04.status).toBe("missing");
    expect(cs04.overclaimed).toBe(true); // over-claim caught independently
  });

  it("does not count a topic mentioned only inside a GAP marker as covered", () => {
    const md = "Capital details follow. [[GAP: shareholding pattern not provided by promoter]]";
    const result = checkCoverage(md, reqs, ["CS-04"]);
    const cs04 = result.find((r) => r.code === "CS-04")!;
    expect(cs04.present).toBe(false);
    expect(cs04.overclaimed).toBe(true);
  });
});
