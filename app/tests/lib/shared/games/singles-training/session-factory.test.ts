import { describe, it, expect } from "vitest";
import {
  buildSinglesTrainingSession,
  TARGET_COUNT,
} from "@lib/shared/games/singles-training";
import { ALL_TARGETS } from "@lib/shared/games/singles-training/target-sequence";

describe("buildSinglesTrainingSession", () => {
  it("creates an active session with low-to-high target sequence", () => {
    const session = buildSinglesTrainingSession({
      direction: "low-to-high",
      mode: "normal",
      scoring: "traditional",
    });

    expect(session.slug).toBe("singles-training");
    expect(session.targetSequence).toEqual(ALL_TARGETS);
    expect(session.targetSequence).toHaveLength(TARGET_COUNT);
    expect(session.state.status).toBe("active");
    expect(session.state.currentTargetIndex).toBe(0);
    expect(session.dartHistory).toEqual([]);
    expect(session.createdAt).toMatch(/^\d{4}-/);
    expect(session.updatedAt).toMatch(/^\d{4}-/);
  });

  it("shuffles target sequence for random direction", () => {
    const session = buildSinglesTrainingSession(
      { direction: "random", mode: "normal", scoring: "traditional" },
      () => 0.5,
    );
    expect(session.targetSequence).toHaveLength(TARGET_COUNT);
    const sortTargets = (a: (typeof ALL_TARGETS)[number], b: (typeof ALL_TARGETS)[number]) =>
      a === "bull" ? 1 : b === "bull" ? -1 : Number(a) - Number(b);
    expect([...session.targetSequence].sort(sortTargets)).toEqual(
      [...ALL_TARGETS].sort(sortTargets),
    );
  });
});
