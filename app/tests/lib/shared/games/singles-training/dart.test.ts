import { describe, it, expect } from "vitest";
import {
  calculateDartPoints,
  formatDartOutcomeLabel,
  isValidOutcomeForTarget,
  isHit,
  buildDartRecord,
} from "@lib/shared/games/singles-training/dart";

describe("calculateDartPoints", () => {
  it("traditional scoring", () => {
    expect(calculateDartPoints({ type: "single" }, "traditional")).toBe(1);
    expect(calculateDartPoints({ type: "double" }, "traditional")).toBe(2);
    expect(calculateDartPoints({ type: "triple" }, "traditional")).toBe(3);
    expect(calculateDartPoints({ type: "miss" }, "traditional")).toBe(0);
  });

  it("uniform scoring", () => {
    expect(calculateDartPoints({ type: "triple" }, "uniform")).toBe(1);
    expect(calculateDartPoints({ type: "miss" }, "uniform")).toBe(0);
  });
});

describe("formatDartOutcomeLabel", () => {
  it("formats number target outcomes", () => {
    expect(formatDartOutcomeLabel(10, { type: "single" })).toBe("S10");
    expect(formatDartOutcomeLabel(10, { type: "miss" })).toBe("Miss");
  });

  it("formats bull target outcomes", () => {
    expect(formatDartOutcomeLabel("bull", { type: "single" })).toBe("25");
    expect(formatDartOutcomeLabel("bull", { type: "double" })).toBe("Bull");
  });
});

describe("isValidOutcomeForTarget", () => {
  it("rejects triple on bull", () => {
    expect(isValidOutcomeForTarget("bull", { type: "triple" })).toBe(false);
  });

  it("accepts single on bull", () => {
    expect(isValidOutcomeForTarget("bull", { type: "single" })).toBe(true);
  });
});

describe("isHit", () => {
  it("returns false for miss", () => {
    expect(isHit({ type: "miss" })).toBe(false);
  });

  it("returns true for non-miss outcomes", () => {
    expect(isHit({ type: "single" })).toBe(true);
    expect(isHit({ type: "double" })).toBe(true);
    expect(isHit({ type: "triple" })).toBe(true);
  });
});

describe("buildDartRecord", () => {
  it("builds record with calculated points", () => {
    expect(
      buildDartRecord(2, 1, { type: "double" }, "traditional"),
    ).toEqual({
      targetIndex: 2,
      dartInVisit: 1,
      outcome: { type: "double" },
      points: 2,
    });
  });
});
