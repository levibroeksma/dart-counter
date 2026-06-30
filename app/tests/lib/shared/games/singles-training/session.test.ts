import { describe, it, expect } from "vitest";
import { isSinglesTrainingSession } from "@lib/shared/games/singles-training";

describe("isSinglesTrainingSession", () => {
  it("returns true for valid session shape", () => {
    const session = {
      slug: "singles-training",
      settings: { direction: "low-to-high", mode: "normal", scoring: "traditional" },
      targetSequence: [1, 2, "bull"],
      state: {
        status: "active",
        currentTargetIndex: 0,
        currentDartInVisit: 0,
        score: 0,
        segmentCounts: { miss: 0, single: 0, double: 0, triple: 0 },
      },
      dartHistory: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(isSinglesTrainingSession(session)).toBe(true);
  });

  it("returns false for wrong slug", () => {
    expect(isSinglesTrainingSession({ slug: "score-training" })).toBe(false);
  });
});
