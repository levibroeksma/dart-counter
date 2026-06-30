import { describe, it, expect } from "vitest";
import { buildSummary, type SinglesTrainingSession } from "@lib/shared/games/singles-training";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";

describe("buildSummary", () => {
  it("computes hit ratio and dart position rates", () => {
    const session: SinglesTrainingSession = {
      slug: "singles-training" as const,
      settings: {
        direction: "low-to-high" as const,
        mode: "normal" as const,
        scoring: "traditional" as const,
      },
      targetSequence: [10, 11],
      state: { ...createInitialGameState(), score: 4, status: "completed" as const },
      dartHistory: [
        { targetIndex: 0, dartInVisit: 0, outcome: { type: "single" as const }, points: 1 },
        { targetIndex: 0, dartInVisit: 1, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 0, dartInVisit: 2, outcome: { type: "double" as const }, points: 2 },
        { targetIndex: 1, dartInVisit: 0, outcome: { type: "triple" as const }, points: 3 },
        { targetIndex: 1, dartInVisit: 1, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 1, dartInVisit: 2, outcome: { type: "miss" as const }, points: 0 },
      ],
      createdAt: "",
      updatedAt: "",
    };
    const summary = buildSummary(session);
    expect(summary.hitRatio).toBeCloseTo(3 / 6);
    expect(summary.dartPositionSuccessRates[0]).toBeCloseTo(2 / 2);
    expect(summary.dartPositionSuccessRates[1]).toBeCloseTo(0 / 2);
    expect(summary.dartPositionSuccessRates[2]).toBeCloseTo(1 / 2);
  });
});
